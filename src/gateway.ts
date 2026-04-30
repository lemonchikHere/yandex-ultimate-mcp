import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ModuleDefinition } from "./types.js";
import { VERSION } from "./version.js";

type ToolWithMeta = Tool & { _ultimate?: { moduleId: string; originalName: string } };

export type GatewayTool = {
  module: ModuleDefinition;
  original: Tool;
  exposed: ToolWithMeta;
};

export type ChildRuntimeStatus = {
  id: string;
  connected: boolean;
  tools: number;
  error?: string;
};

export class McpChild {
  readonly module: ModuleDefinition;
  private client?: Client;
  private transport?: StdioClientTransport;
  private connected = false;
  private cachedTools?: Tool[];
  private lastError?: string;

  constructor(module: ModuleDefinition) {
    this.module = module;
  }

  status(): ChildRuntimeStatus {
    return {
      id: this.module.id,
      connected: this.connected,
      tools: this.cachedTools?.length ?? 0,
      error: this.lastError
    };
  }

  async listTools(timeoutMs: number): Promise<Tool[]> {
    if (this.cachedTools) return this.cachedTools;
    try {
      await this.ensureConnected(timeoutMs);
      const result = await withTimeout(this.client!.listTools(), timeoutMs, `${this.module.id}: listTools timeout`);
      this.cachedTools = result.tools;
      this.lastError = undefined;
      return result.tools;
    } catch (error) {
      this.lastError = errorToMessage(error);
      throw error;
    }
  }

  async callTool(name: string, args: Record<string, unknown> | undefined, timeoutMs: number): Promise<CallToolResult> {
    try {
      await this.ensureConnected(timeoutMs);
      const result = await withTimeout(
        this.client!.callTool({ name, arguments: args ?? {} }),
        timeoutMs,
        `${this.module.id}: callTool(${name}) timeout`
      );
      this.lastError = undefined;
      return result as CallToolResult;
    } catch (error) {
      this.lastError = errorToMessage(error);
      throw error;
    }
  }

  async close(): Promise<void> {
    this.cachedTools = undefined;
    this.connected = false;
    try {
      await this.client?.close();
    } catch {
      // best effort
    }
    try {
      await this.transport?.close();
    } catch {
      // best effort
    }
    this.client = undefined;
    this.transport = undefined;
  }

  async refresh(): Promise<void> {
    this.cachedTools = undefined;
  }

  private async ensureConnected(timeoutMs: number): Promise<void> {
    if (this.connected) return;

    const env = this.module.env(process.env);
    this.client = new Client(
      { name: `yandex-ultimate-child-${this.module.id}`, version: VERSION },
      { capabilities: {} }
    );
    this.transport = new StdioClientTransport({
      command: this.module.command,
      args: this.module.args,
      env,
      stderr: process.env.ULTIMATE_CHILD_STDERR === "inherit" ? "inherit" : "pipe"
    });

    await withTimeout(this.client.connect(this.transport), timeoutMs, `${this.module.id}: connect timeout`);
    this.connected = true;
  }
}

export class UltimateGateway {
  private children = new Map<string, McpChild>();
  private exposed = new Map<string, GatewayTool>();
  private listErrors = new Map<string, string>();

  constructor(private readonly modules: ModuleDefinition[]) {
    for (const mod of modules) this.children.set(mod.id, new McpChild(mod));
  }

  runtimeStatuses(): ChildRuntimeStatus[] {
    return Array.from(this.children.values()).map((child) => child.status());
  }

  listErrorEntries(): Array<{ moduleId: string; error: string }> {
    return Array.from(this.listErrors.entries()).map(([moduleId, error]) => ({ moduleId, error }));
  }

  async listGatewayTools(timeoutMs: number, alwaysPrefix: boolean): Promise<GatewayTool[]> {
    const rows: Array<{ module: ModuleDefinition; tool: Tool }> = [];
    this.listErrors.clear();

    for (const mod of this.modules) {
      const child = this.children.get(mod.id)!;
      try {
        const tools = await child.listTools(timeoutMs);
        for (const tool of tools) rows.push({ module: mod, tool });
      } catch (error) {
        this.listErrors.set(mod.id, errorToMessage(error));
      }
    }

    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.tool.name, (counts.get(row.tool.name) ?? 0) + 1);

    this.exposed.clear();
    const gatewayTools: GatewayTool[] = rows.map((row) => {
      const exposedName = alwaysPrefix || (counts.get(row.tool.name) ?? 0) > 1
        ? `${row.module.id}__${row.tool.name}`
        : row.tool.name;
      const exposed: ToolWithMeta = {
        ...row.tool,
        name: exposedName,
        description: decorateDescription(row.module, row.tool.description),
        _meta: {
          ...(row.tool._meta ?? {}),
          "yandex-ultimate/module": row.module.id,
          "yandex-ultimate/originalTool": row.tool.name,
          "yandex-ultimate/source": row.module.sourceUrl
        },
        _ultimate: { moduleId: row.module.id, originalName: row.tool.name }
      };
      const gw = { module: row.module, original: row.tool, exposed };
      this.exposed.set(exposedName, gw);
      return gw;
    });

    return gatewayTools.sort((a, b) => a.exposed.name.localeCompare(b.exposed.name));
  }

  getMapping(name: string): GatewayTool | undefined {
    return this.exposed.get(name);
  }

  async callExposedTool(name: string, args: Record<string, unknown> | undefined, timeoutMs: number): Promise<CallToolResult> {
    const mapping = this.exposed.get(name);
    if (!mapping) throw new Error(`Unknown ultimate tool: ${name}. Run tools/list first or call ultimate_refresh_tools.`);
    const child = this.children.get(mapping.module.id)!;
    return child.callTool(mapping.original.name, args, timeoutMs);
  }

  async refresh(): Promise<void> {
    this.exposed.clear();
    this.listErrors.clear();
    await Promise.all(Array.from(this.children.values()).map((child) => child.refresh()));
  }

  async close(): Promise<void> {
    await Promise.all(Array.from(this.children.values()).map((child) => child.close()));
  }
}

function decorateDescription(module: ModuleDefinition, description: string | undefined): string {
  const base = description?.trim() || "Proxied MCP tool.";
  return `${base}\n\n[ultimate] module=${module.id}; source=${module.sourceUrl}; license=${module.license}`;
}

export function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

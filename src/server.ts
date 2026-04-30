import { readFileSync } from "node:fs";
import { config as dotenvConfig } from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { authHelp } from "./auth.js";
import { makeStatusReport, modulesReport } from "./doctor.js";
import { UltimateGateway, errorToMessage } from "./gateway.js";
import { MANAGEMENT_TOOLS } from "./management-tools.js";
import { getModuleStatuses, isTruthy, MODULES } from "./modules.js";
import { PROJECT_NAME, VERSION } from "./version.js";

export type ServeOptions = {
  timeoutMs?: number;
};

export async function serve(options: ServeOptions = {}): Promise<void> {
  loadDotenv();

  const timeoutMs = Number(process.env.ULTIMATE_CHILD_TIMEOUT_MS ?? options.timeoutMs ?? 20_000);
  const alwaysPrefix = isTruthy(process.env.ULTIMATE_PREFIX_TOOLS);
  const enabledIds = new Set(getModuleStatuses(process.env).filter((status) => status.enabled).map((status) => status.id));
  const modules = MODULES.filter((module) => enabledIds.has(module.id));
  const gateway = new UltimateGateway(modules);

  const server = new Server(
    { name: PROJECT_NAME, version: VERSION },
    {
      capabilities: { tools: { listChanged: true } },
      instructions: "Unofficial Yandex Ultimate MCP gateway. Use ultimate_status first to see configured modules and missing credentials."
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const childTools = await gateway.listGatewayTools(timeoutMs, alwaysPrefix);
    const tools: Tool[] = [...MANAGEMENT_TOOLS, ...childTools.map((item) => item.exposed)];
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    try {
      if (name === "ultimate_status") {
        return textResult(makeStatusReport({ runtime: gateway.runtimeStatuses(), listErrors: gateway.listErrorEntries() }));
      }
      if (name === "ultimate_modules") return textResult(modulesReport());
      if (name === "ultimate_auth_help") return textResult(authHelp(typeof args.service === "string" ? args.service : undefined));
      if (name === "ultimate_refresh_tools") {
        await gateway.refresh();
        return textResult("Tool cache cleared. Run tools/list to reload child MCP tools.");
      }

      if (!gateway.getMapping(name)) {
        await gateway.listGatewayTools(timeoutMs, alwaysPrefix);
      }
      return await gateway.callExposedTool(name, args, timeoutMs);
    } catch (error) {
      throw new McpError(ErrorCode.InternalError, errorToMessage(error));
    }
  });

  const shutdown = async () => {
    await gateway.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await server.connect(new StdioServerTransport());
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function loadDotenv(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      readFileSync(file);
      dotenvConfig({ path: file, override: false, quiet: true });
    } catch {
      // optional
    }
  }
}

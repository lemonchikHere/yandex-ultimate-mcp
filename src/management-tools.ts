import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const MANAGEMENT_TOOLS: Tool[] = [
  {
    name: "ultimate_status",
    title: "Ultimate status",
    description: "Show configured/enabled modules, missing credentials, runtime errors and loaded tool counts.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "ultimate_modules",
    title: "Ultimate modules",
    description: "List bundled upstream MCP modules, expected tool counts, sources and licenses.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "ultimate_auth_help",
    title: "Ultimate auth help",
    description: "Return concise auth/token setup instructions for Yandex services.",
    inputSchema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Optional service filter: direct, metrika, webmaster, tracker, cloud, maps, search." }
      }
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "ultimate_refresh_tools",
    title: "Refresh child tools",
    description: "Clear child tool cache so the next tools/list reloads upstream MCP tool lists.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false }
  }
];

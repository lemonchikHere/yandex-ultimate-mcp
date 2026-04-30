#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/src/cli.js", "serve"],
  env: { ...process.env, ULTIMATE_DISABLE_CHILDREN: "1" }
});
const client = new Client({ name: "yandex-ultimate-smoke", version: "0.0.0" }, { capabilities: {} });

try {
  await client.connect(transport);
  const list = await client.listTools();
  const names = list.tools.map((tool) => tool.name).sort();
  for (const required of ["ultimate_status", "ultimate_modules", "ultimate_auth_help", "ultimate_refresh_tools"]) {
    if (!names.includes(required)) throw new Error(`missing management tool: ${required}`);
  }
  const status = await client.callTool({ name: "ultimate_status", arguments: {} });
  if (!status.content?.[0] || status.content[0].type !== "text") throw new Error("ultimate_status did not return text");
  console.log(`smoke ok: ${names.length} tools (${names.join(", ")})`);
} finally {
  await client.close();
  await transport.close();
}

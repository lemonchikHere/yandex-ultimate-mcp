#!/usr/bin/env node
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { extractAccessToken, makeOAuthUrl, parseEnv, serializeEnv } from "../dist/src/auth.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/src/cli.js", "serve"],
  env: { ...process.env, ULTIMATE_DISABLE_CHILDREN: "1" }
});
const client = new Client({ name: "yandex-ultimate-smoke", version: "0.0.0" }, { capabilities: {} });

try {
  assert.equal(extractAccessToken("https://oauth.yandex.ru/verification_code#access_token=abc-123_DEF&expires_in=31536000"), "abc-123_DEF");
  assert.equal(extractAccessToken("abc_def-12345678901234567890"), "abc_def-12345678901234567890");
  assert.equal(
    makeOAuthUrl("client-id", "http://127.0.0.1:17893/callback"),
    "https://oauth.yandex.ru/authorize?response_type=token&client_id=client-id&redirect_uri=http%3A%2F%2F127.0.0.1%3A17893%2Fcallback"
  );
  assert.deepEqual(parseEnv("YANDEX_TOKEN=old\nYANDEX_TOKEN=new\nQUOTED=\"hello world\"\n"), {
    YANDEX_TOKEN: "new",
    QUOTED: "hello world"
  });
  assert.equal(
    serializeEnv("YANDEX_TOKEN=old\nYANDEX_TOKEN=stale\nOTHER=1\n", { YANDEX_TOKEN: "fresh", YC_FOLDER_ID: "folder" }, new Date("2026-04-30T00:00:00.000Z")),
    "YANDEX_TOKEN=fresh\nOTHER=1\n\n# Added by yandex-ultimate-mcp auth wizard at 2026-04-30T00:00:00.000Z\nYC_FOLDER_ID=folder\n"
  );
  assert.equal(
    serializeEnv("", { YANDEX_TOKEN: "fresh" }, new Date("2026-04-30T00:00:00.000Z")),
    "# Added by yandex-ultimate-mcp auth wizard at 2026-04-30T00:00:00.000Z\nYANDEX_TOKEN=fresh\n"
  );

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

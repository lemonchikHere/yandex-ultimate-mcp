#!/usr/bin/env node
import { config as dotenvConfig } from "dotenv";
import { runAuthWizard } from "./auth.js";
import { modulesReport, runDoctor } from "./doctor.js";
import { serve } from "./server.js";
import { PROJECT_NAME, VERSION } from "./version.js";

dotenvConfig({ path: ".env.local", override: false, quiet: true });
dotenvConfig({ path: ".env", override: false, quiet: true });

const [command = "serve", ...args] = process.argv.slice(2);

try {
  if (command === "serve") {
    await serve();
  } else if (command === "doctor") {
    process.exitCode = await runDoctor();
  } else if (command === "auth") {
    await runAuthWizard();
  } else if (command === "modules") {
    console.log(modulesReport());
  } else if (command === "version" || command === "--version" || command === "-v") {
    console.log(`${PROJECT_NAME} ${VERSION}`);
  } else if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
  } else {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}

function printHelp(): void {
  console.log(`
${PROJECT_NAME} ${VERSION}

Usage:
  yandex-ultimate-mcp serve      Start MCP server over stdio (default)
  yandex-ultimate-mcp doctor     Check environment and configured modules
  yandex-ultimate-mcp auth       Interactive token/API-key helper (.env.local)
  yandex-ultimate-mcp modules    Print bundled upstream module catalog
  yandex-ultimate-mcp version    Print version

Env knobs:
  ULTIMATE_ENABLE_MODULES=stegyan,webmaster   Enable only these modules
  ULTIMATE_DISABLE_MODULES=cloud_docs         Disable selected modules
  ULTIMATE_DISABLE_CHILDREN=1                 Only management tools (smoke tests)
  ULTIMATE_PREFIX_TOOLS=1                     Always expose module__tool_name
  ULTIMATE_CHILD_TIMEOUT_MS=20000             Child MCP connect/list/call timeout
`);
}

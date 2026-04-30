import { spawn } from "node:child_process";
import { getModuleStatuses, MODULES } from "./modules.js";
import type { ModuleStatus } from "./types.js";

export async function runDoctor(): Promise<number> {
  const statuses = getModuleStatuses(process.env);
  const bins = await checkBinaries(["node", "npx"]);

  console.log("Yandex Ultimate MCP doctor\n");
  for (const [bin, ok] of Object.entries(bins)) {
    console.log(`${ok ? "✓" : "✗"} ${bin}`);
  }
  console.log("");

  for (const status of statuses) printStatus(status);

  const enabledCount = statuses.filter((s) => s.enabled).length;
  const configuredCount = statuses.filter((s) => s.configured).length;
  console.log(`\nConfigured modules: ${configuredCount}/${statuses.length}. Enabled now: ${enabledCount}/${statuses.length}.`);
  console.log("Run `yandex-ultimate auth` or read docs/AUTH.md to add tokens/API keys.");
  return enabledCount > 0 || process.env.ULTIMATE_DISABLE_CHILDREN === "1" ? 0 : 1;
}

export function makeStatusReport(extra?: { runtime?: unknown; listErrors?: unknown }): string {
  const statuses = getModuleStatuses(process.env);
  const payload = {
    ok: true,
    envFileHint: ".env.local is loaded automatically by the CLI",
    configuredModules: statuses.filter((s) => s.configured).length,
    enabledModules: statuses.filter((s) => s.enabled).length,
    modules: statuses,
    ...extra
  };
  return JSON.stringify(payload, null, 2);
}

function printStatus(status: ModuleStatus): void {
  const mark = status.enabled ? "✓" : status.configured ? "•" : "!";
  console.log(`${mark} ${status.id} — ${status.title}`);
  console.log(`  expected tools: ${status.expectedTools ?? "unknown"}; license: ${status.license}`);
  console.log(`  source: ${status.sourceUrl}`);
  if (status.enabled) console.log("  status: enabled");
  else if (status.configured) console.log("  status: configured but disabled by ULTIMATE_ENABLE_MODULES/ULTIMATE_DISABLE_MODULES/ULTIMATE_DISABLE_CHILDREN");
  else console.log(`  missing: ${status.missing.join("; ")}`);
}

async function checkBinaries(bins: string[]): Promise<Record<string, boolean>> {
  const entries = await Promise.all(bins.map(async (bin) => [bin, await canRun(bin, ["--version"])] as const));
  return Object.fromEntries(entries);
}

function canRun(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

export function modulesReport(): string {
  return JSON.stringify(MODULES.map((module) => ({
    id: module.id,
    title: module.title,
    description: module.description,
    expectedTools: module.expectedTools,
    categories: module.categories,
    command: [module.command, ...module.args].join(" "),
    requiredEnv: module.requiredEnv,
    optionalEnv: module.optionalEnv ?? [],
    docsUrl: module.docsUrl,
    sourceUrl: module.sourceUrl,
    license: module.license
  })), null, 2);
}

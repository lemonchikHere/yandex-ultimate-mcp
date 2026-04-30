import { spawn } from "node:child_process";
import { getModuleStatuses, MODULES } from "./modules.js";
import type { ModuleStatus } from "./types.js";

type LiveCheck = {
  id: string;
  ok: boolean;
  skipped?: boolean;
  message: string;
};

export async function runDoctor(): Promise<number> {
  const statuses = getModuleStatuses(process.env);
  const bins = await checkBinaries(["node", "npx"]);
  const liveChecks = await runLiveChecks();

  console.log("Yandex Ultimate MCP doctor\n");
  for (const [bin, ok] of Object.entries(bins)) {
    console.log(`${ok ? "✓" : "✗"} ${bin}`);
  }
  console.log("");

  for (const status of statuses) printStatus(status);

  if (liveChecks.length) {
    console.log("\nLive API checks:");
    for (const check of liveChecks) {
      const mark = check.skipped ? "•" : check.ok ? "✓" : "✗";
      console.log(`${mark} ${check.id}: ${check.message}`);
    }
  }

  const enabledCount = statuses.filter((s) => s.enabled).length;
  const configuredCount = statuses.filter((s) => s.configured).length;
  const failedLiveChecks = liveChecks.filter((check) => !check.skipped && !check.ok).length;
  console.log(`\nConfigured modules: ${configuredCount}/${statuses.length}. Enabled now: ${enabledCount}/${statuses.length}.`);
  console.log("Run `npm run auth` or read docs/AUTH.md to add tokens/API keys.");
  if (failedLiveChecks) return 1;
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

async function runLiveChecks(): Promise<LiveCheck[]> {
  if (["0", "false", "off", "no"].includes((process.env.ULTIMATE_DOCTOR_LIVE ?? "").toLowerCase())) return [];
  return [await checkWebmasterToken()];
}

async function checkWebmasterToken(): Promise<LiveCheck> {
  const token = pickEnv(["YANDEX_WEBMASTER_TOKEN", "YANDEX_WEBMASTER_OAUTH_TOKEN", "YANDEX_TOKEN"]);
  if (!token) {
    return { id: "webmaster-token", ok: false, skipped: true, message: "skipped, no YANDEX_WEBMASTER_TOKEN / YANDEX_WEBMASTER_OAUTH_TOKEN / YANDEX_TOKEN" };
  }

  try {
    const response = await fetch("https://api.webmaster.yandex.net/v4/user", {
      headers: { Authorization: `OAuth ${token}` },
      signal: AbortSignal.timeout(15_000)
    });
    const text = await response.text();

    if (response.ok) {
      const parsed = safeJson(text);
      const hasUserId = Boolean(parsed && typeof parsed === "object" && "user_id" in parsed);
      return {
        id: "webmaster-token",
        ok: true,
        message: hasUserId ? "valid: /v4/user returned user_id" : "valid: /v4/user returned 2xx"
      };
    }

    return {
      id: "webmaster-token",
      ok: false,
      message: `invalid: HTTP ${response.status} ${summarizeWebmasterError(text)}`
    };
  } catch (error) {
    return {
      id: "webmaster-token",
      ok: false,
      message: `check failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

function summarizeWebmasterError(text: string): string {
  const parsed = safeJson(text);
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    const code = typeof record.error_code === "string" ? record.error_code : undefined;
    const message = typeof record.error_message === "string" ? record.error_message : undefined;
    if (code || message) return [code, message].filter(Boolean).join(" — ");
  }
  return text.slice(0, 300).replace(/[A-Za-z0-9_-]{28,}/g, "[REDACTED_LONG]");
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function pickEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value?.trim()) return value.trim();
  }
  return undefined;
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

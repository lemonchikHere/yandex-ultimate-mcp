import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ENV_FILE = ".env.local";

export const AUTH_GUIDE_RU = `
# Быстрый auth для Yandex Ultimate MCP

1. Создай OAuth-приложение в Yandex OAuth: https://oauth.yandex.ru/client/new
2. Добавь нужные permissions/scopes:
   - Metrika: metrika:read / metrika:write (см. https://yandex.ru/dev/metrika/en/intro/authorization)
   - Direct/Wordstat: права к Direct API + доступ через рекламный аккаунт (https://yandex.ru/dev/direct/doc/en/concepts/register)
   - Webmaster: права Webmaster API (https://yandex.ru/dev/webmaster/doc/en/tasks/how-to-get-oauth)
   - Tracker: Tracker API + org id
   - Cloud/Search: API key или OAuth + YC folder id
   - Maps: API key в кабинете разработчика Яндекс.Карт
3. Получи OAuth token по ссылке:
   https://oauth.yandex.ru/authorize?response_type=token&client_id=YOUR_CLIENT_ID
4. Сохрани значения в .env.local или в MCP-клиенте.
`;

export const AUTH_GUIDE_EN = `
# Quick auth for Yandex Ultimate MCP

1. Create a Yandex OAuth app: https://oauth.yandex.ru/client/new
2. Add the permissions/scopes you need for Metrika, Direct, Webmaster, Tracker and Cloud.
3. Open: https://oauth.yandex.ru/authorize?response_type=token&client_id=YOUR_CLIENT_ID
4. Save tokens/API keys in .env.local or in your MCP client config.
`;

export function authHelp(service?: string): string {
  const filter = service ? `\nRequested service: ${service}\n` : "";
  return `${AUTH_GUIDE_RU}${filter}\n${serviceHints(service)}\n---\n${AUTH_GUIDE_EN}`;
}

function serviceHints(service?: string): string {
  const hints: Record<string, string> = {
    metrika: "Env: YANDEX_METRIKA_TOKEN or universal YANDEX_TOKEN.",
    direct: "Env: YANDEX_DIRECT_TOKEN or YANDEX_TOKEN; optional YANDEX_CLIENT_LOGIN and YANDEX_USE_SANDBOX=1.",
    wordstat: "Wordstat is usually covered by Direct credentials in @stegyan/yandex-mcp.",
    webmaster: "Env: YANDEX_WEBMASTER_OAUTH_TOKEN; optional YANDEX_WEBMASTER_HOST_URL.",
    tracker: "Env: YANDEX_TRACKER_TOKEN and YANDEX_TRACKER_ORG_ID.",
    cloud: "Env: YC_OAUTH_TOKEN/YC_FOLDER_ID or YANDEX_CLOUD_TOKEN/YANDEX_FOLDER_ID.",
    search: "Env: YANDEX_SEARCH_API_KEY and YANDEX_SEARCH_FOLDER_ID.",
    maps: "Env: YANDEX_MAPS_API_KEY; optional YANDEX_MAPS_STATIC_API_KEY."
  };
  if (!service) return Object.entries(hints).map(([key, value]) => `- ${key}: ${value}`).join("\n");
  return hints[service.toLowerCase()] ?? `No specific hint for ${service}; use docs/AUTH.md.`;
}

export async function runAuthWizard(): Promise<void> {
  console.log(AUTH_GUIDE_RU.trim());
  const rl = createInterface({ input, output });
  try {
    const clientId = (await rl.question("YANDEX_CLIENT_ID (optional, Enter to skip OAuth URL): ")).trim();
    if (clientId) {
      console.log(`\nOAuth URL:\nhttps://oauth.yandex.ru/authorize?response_type=token&client_id=${encodeURIComponent(clientId)}\n`);
    }

    const entries: Record<string, string> = {};
    for (const key of [
      "YANDEX_TOKEN",
      "YANDEX_CLIENT_LOGIN",
      "YANDEX_WEBMASTER_OAUTH_TOKEN",
      "YANDEX_TRACKER_TOKEN",
      "YANDEX_TRACKER_ORG_ID",
      "YC_OAUTH_TOKEN",
      "YC_FOLDER_ID",
      "YANDEX_SEARCH_API_KEY",
      "YANDEX_SEARCH_FOLDER_ID",
      "YANDEX_MAPS_API_KEY"
    ]) {
      const value = (await rl.question(`${key} (optional): `)).trim();
      if (value) entries[key] = value;
    }

    if (!Object.keys(entries).length) {
      console.log("No values entered; nothing written.");
      return;
    }

    const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
    const lines = ["", `# Added by yandex-ultimate-mcp auth wizard at ${new Date().toISOString()}`];
    for (const [key, value] of Object.entries(entries)) {
      lines.push(`${key}=${escapeEnv(value)}`);
    }
    if (existing.trim()) appendFileSync(ENV_FILE, `${lines.join("\n")}\n`);
    else writeFileSync(ENV_FILE, `${lines.slice(1).join("\n")}\n`);

    console.log(`Saved ${Object.keys(entries).length} value(s) to ${ENV_FILE}.`);
  } finally {
    rl.close();
  }
}

function escapeEnv(value: string): string {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

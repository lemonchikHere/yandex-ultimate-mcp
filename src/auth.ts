import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ENV_FILE = ".env.local";

export const AUTH_GUIDE_RU = `
# 🚀 Автовход и получение ключей/токенов для Yandex Ultimate MCP

Самый быстрый путь:
1. Создай OAuth-приложение: https://oauth.yandex.ru/client/new
2. Включи доступы для API: Metrika, Direct, Webmaster, Tracker. Для Cloud/Search/Maps чаще нужны отдельные ключи.
3. Скопируй ClientID и открой:
   https://oauth.yandex.ru/authorize?response_type=token&client_id=YOUR_CLIENT_ID
4. После логина вставь в wizard ВЕСЬ callback URL вида:
   https://.../callback#access_token=...&token_type=bearer&expires_in=...
5. Wizard сам вытащит access_token и разложит его по YANDEX_TOKEN/YANDEX_METRIKA_TOKEN/YANDEX_DIRECT_TOKEN/etc.

Важно:
- YANDEX_CLIENT_LOGIN — это НЕ токен. Это логин клиента/аккаунта в Yandex Direct.
- Если токен случайно утек в чат/логи, лучше отозвать его и выпустить новый.
`;

export const AUTH_GUIDE_EN = `
# 🚀 Auto login and token/key setup for Yandex Ultimate MCP

Fast path:
1. Create a Yandex OAuth app: https://oauth.yandex.ru/client/new
2. Enable API permissions for Metrika, Direct, Webmaster and Tracker. Cloud/Search/Maps often need separate keys.
3. Copy ClientID and open:
   https://oauth.yandex.ru/authorize?response_type=token&client_id=YOUR_CLIENT_ID
4. Paste the full callback URL into the wizard. It will extract access_token automatically.

Note: YANDEX_CLIENT_LOGIN is not a token; it is a Yandex Direct client/account login.
`;

export function authHelp(service?: string): string {
  const filter = service ? `\nRequested service: ${service}\n` : "";
  return `${AUTH_GUIDE_RU}${filter}\n${serviceHints(service)}\n---\n${AUTH_GUIDE_EN}`;
}

function serviceHints(service?: string): string {
  const hints: Record<string, string> = {
    metrika: "Env: YANDEX_METRIKA_TOKEN or universal YANDEX_TOKEN.",
    direct: "Env: YANDEX_DIRECT_TOKEN or YANDEX_TOKEN. YANDEX_CLIENT_LOGIN is the Direct client/account login, not a token.",
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
  printHero();
  const rl = createInterface({ input, output });
  try {
    const clientId = (await ask(rl, "🔑 Yandex OAuth ClientID", "Enter пропустить")).trim();
    if (clientId) {
      console.log(box("🌐 Открой эту ссылку, залогинься и скопируй весь callback URL", [
        `https://oauth.yandex.ru/authorize?response_type=token&client_id=${encodeURIComponent(clientId)}`
      ]));
    }

    const entries: Record<string, string> = {};
    const rawOAuth = (await ask(rl, "📥 OAuth callback URL или чистый access_token", "можно вставить целиком URL с #access_token=...")).trim();
    const token = extractAccessToken(rawOAuth);
    if (token) {
      const spread = await askYesNo(rl, "✨ Разложить этот OAuth token по YANDEX_TOKEN/METRIKA/DIRECT/WEBMASTER/TRACKER?", true);
      if (spread) {
        entries.YANDEX_TOKEN = token;
        entries.YANDEX_METRIKA_TOKEN = token;
        entries.YANDEX_DIRECT_TOKEN = token;
        entries.YANDEX_WEBMASTER_OAUTH_TOKEN = token;
        entries.YANDEX_TRACKER_TOKEN = token;
      } else {
        entries.YANDEX_TOKEN = token;
      }
      console.log(`✅ access_token найден: ${redact(token)}`);
    } else if (rawOAuth) {
      console.log("⚠️  Не нашел access_token. Значение не сохранено — вставь URL с #access_token=... или сам токен.");
    }

    await askAndSave(rl, entries, "🏷️  YANDEX_CLIENT_LOGIN", "логин клиента/аккаунта Direct, НЕ токен", "YANDEX_CLIENT_LOGIN");
    await askAndSave(rl, entries, "🏢 YANDEX_TRACKER_ORG_ID", "org/cloud id для Tracker", "YANDEX_TRACKER_ORG_ID");
    await askAndSave(rl, entries, "☁️  YC_OAUTH_TOKEN", "Cloud OAuth token, если отличается от общего", "YC_OAUTH_TOKEN");
    await askAndSave(rl, entries, "📁 YC_FOLDER_ID", "folder id для Cloud/Search", "YC_FOLDER_ID");
    await askAndSave(rl, entries, "🔎 YANDEX_SEARCH_API_KEY", "API key service account для Search API", "YANDEX_SEARCH_API_KEY");
    await askAndSave(rl, entries, "🔎 YANDEX_SEARCH_FOLDER_ID", "folder id для Search API", "YANDEX_SEARCH_FOLDER_ID");
    await askAndSave(rl, entries, "🗺️  YANDEX_MAPS_API_KEY", "ключ Maps/Geocoder/Routing", "YANDEX_MAPS_API_KEY");
    await askAndSave(rl, entries, "🖼️  YANDEX_MAPS_STATIC_API_KEY", "опционально, static maps key", "YANDEX_MAPS_STATIC_API_KEY");

    if (!Object.keys(entries).length) {
      console.log("😴 Ничего не ввели — .env.local не изменен.");
      return;
    }

    writeEnv(entries);
    console.log(box("✅ Готово", [
      `Сохранено значений: ${Object.keys(entries).length} → ${ENV_FILE}`,
      "Следующий шаг: npm run doctor",
      "Потом: npm run start"
    ]));
    console.log("Сохраненные ключи:");
    for (const [key, value] of Object.entries(entries)) console.log(`  ${key}=${redact(value)}`);
  } finally {
    rl.close();
  }
}

export function extractAccessToken(value: string): string | undefined {
  const raw = value.trim();
  if (!raw) return undefined;

  const direct = raw.match(/(?:^|[?#&])access_token=([^&#]+)/);
  if (direct?.[1]) return decodeURIComponent(direct[1]);

  try {
    const url = new URL(raw);
    const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    const hashParams = new URLSearchParams(hash);
    const hashToken = hashParams.get("access_token");
    if (hashToken) return hashToken;
    const searchToken = url.searchParams.get("access_token");
    if (searchToken) return searchToken;
  } catch {
    // Not a URL. Treat likely token strings as tokens.
  }

  if (/^[A-Za-z0-9._~+/-]{20,}$/.test(raw) && !raw.includes(" ")) return raw;
  return undefined;
}

function writeEnv(entries: Record<string, string>): void {
  const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const lines = ["", `# Added by yandex-ultimate-mcp auth wizard at ${new Date().toISOString()}`];
  for (const [key, value] of Object.entries(entries)) lines.push(`${key}=${escapeEnv(value)}`);
  if (existing.trim()) appendFileSync(ENV_FILE, `${lines.join("\n")}\n`);
  else writeFileSync(ENV_FILE, `${lines.slice(1).join("\n")}\n`);
}

async function askAndSave(
  rl: ReturnType<typeof createInterface>,
  entries: Record<string, string>,
  label: string,
  hint: string,
  key: string
): Promise<void> {
  const value = (await ask(rl, label, hint)).trim();
  if (value) entries[key] = extractAccessToken(value) ?? value;
}

async function askYesNo(rl: ReturnType<typeof createInterface>, question: string, defaultYes: boolean): Promise<boolean> {
  const suffix = defaultYes ? "Y/n" : "y/N";
  const answer = (await rl.question(`${question} [${suffix}]: `)).trim().toLowerCase();
  if (!answer) return defaultYes;
  return ["y", "yes", "д", "да"].includes(answer);
}

async function ask(rl: ReturnType<typeof createInterface>, label: string, hint: string): Promise<string> {
  return rl.question(`${label}\n   ${dim(hint)}\n   › `);
}

function printHero(): void {
  console.log(box("🚀 Yandex Ultimate MCP — Автовход и токены", [
    "Вставляй полный callback URL — access_token вытащится сам.",
    "YANDEX_CLIENT_LOGIN — это логин Direct, а не токен.",
    "Секреты пишем в .env.local, в git они не попадут."
  ]));
}

function box(title: string, lines: string[]): string {
  const width = Math.max(title.length, ...lines.map((line) => stripAnsi(line).length)) + 4;
  const top = `╭${"─".repeat(width)}╮`;
  const bottom = `╰${"─".repeat(width)}╯`;
  const body = [`│ ${title}${" ".repeat(width - title.length - 1)}│`];
  for (const line of lines) body.push(`│ ${line}${" ".repeat(width - stripAnsi(line).length - 1)}│`);
  return [top, ...body, bottom].join("\n");
}

function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`;
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function redact(value: string): string {
  if (value.length <= 12) return "***";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function escapeEnv(value: string): string {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

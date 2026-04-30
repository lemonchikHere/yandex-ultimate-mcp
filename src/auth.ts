import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { platform } from "node:os";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ENV_FILE = ".env.local";
const DEFAULT_AUTH_PORT = 17893;
const OAUTH_APP_URL = "https://oauth.yandex.ru/client/new";
const MANUAL_OAUTH_REDIRECT_URI = "https://oauth.yandex.ru/verification_code";
const DIRECT_API_DOC_URL = "https://yandex.ru/dev/direct/doc/en/concepts/register";
const DIRECT_API_REQUEST_URL = "https://direct.yandex.ru/registered/main.pl?cmd=apiCertificationRequestList";
const CLOUD_CONSOLE_URL = "https://console.yandex.cloud/";
const MAPS_KEYS_URL = "https://developer.tech.yandex.ru/services/";
const SITE_SEARCH_ACCESS_URL = "https://yandex.ru/dev/site/doc/ru/concepts/access";
const SITE_SEARCH_MY_SEARCHES_URL = "https://site.yandex.ru/";
const ENV_KEY_RE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

export const AUTH_GUIDE_RU = `
# 🚀 Автовход и получение ключей/токенов для Yandex Ultimate MCP

Красивый путь без копания в ссылках:
1. Запусти: npm run auth
2. Wizard сам откроет создание OAuth app.
3. В OAuth app выбери «Для доступа к API или отладки».
4. Redirect URI для официального ручного режима: ${MANUAL_OAUTH_REDIRECT_URI}.
5. Опционально добавь localhost Redirect URI из wizard, если хочешь auto-capture.
6. В «Доступ к данным» выбери Metrika / Direct / Webmaster / Tracker.
7. Вставь ClientID — wizard сам откроет authorize URL.
8. Если включен auto-capture — token поймается локально. Иначе вставь URL вида ${MANUAL_OAUTH_REDIRECT_URI}#access_token=...

Важно:
- YANDEX_CLIENT_LOGIN — это НЕ токен. Это логин клиента/аккаунта в Yandex Direct.
- Webmaster обычно использует тот же OAuth access_token.
- Cloud/Search/Maps чаще требуют отдельные ключи; wizard подхватывает локальный yc config и открывает нужные кабинеты.
- Если нужен именно Helium с твоими cookies: ULTIMATE_BROWSER_APP=Helium npm run auth
- Если токен случайно утек в чат/логи, лучше отозвать его и выпустить новый.
`;

export const AUTH_GUIDE_EN = `
# 🚀 Auto login and token/key setup for Yandex Ultimate MCP

Smooth path:
1. Run: npm run auth
2. The wizard opens Yandex OAuth app creation.
3. Choose For API access or debugging.
4. Redirect URI for the official manual flow: ${MANUAL_OAUTH_REDIRECT_URI}.
5. Optionally add the wizard localhost URI for auto-capture.
6. Select Metrika / Direct / Webmaster / Tracker data access.
7. Paste ClientID; the wizard opens the authorize URL.
8. If auto-capture is enabled, the local callback captures access_token. Otherwise paste the final URL/token.

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
    webmaster: "Env: YANDEX_WEBMASTER_TOKEN or YANDEX_WEBMASTER_OAUTH_TOKEN. In OAuth app data access search for `webmaster` and select all 3 scopes.",
    tracker: "Env: YANDEX_TRACKER_TOKEN and YANDEX_TRACKER_ORG_ID.",
    cloud: "Env: YC_OAUTH_TOKEN/YC_FOLDER_ID or YANDEX_CLOUD_TOKEN/YANDEX_FOLDER_ID.",
    search: "Cloud Search MCP: YANDEX_SEARCH_API_KEY and YANDEX_FOLDER_ID. Site Search is separate: developer.tech key + site.yandex.ru search.",
    maps: "Env: YANDEX_MAPS_API_KEY; optional YANDEX_MAPS_STATIC_API_KEY."
  };
  if (!service) return Object.entries(hints).map(([key, value]) => `- ${key}: ${value}`).join("\n");
  return hints[service.toLowerCase()] ?? `No specific hint for ${service}; use docs/AUTH.md.`;
}

export async function runAuthWizard(): Promise<void> {
  const capture = await startOAuthCapture();
  printHero(capture.redirectUri);
  const defaults = await loadAuthDefaults();

  const rl = createInterface({ input, output });
  try {
    const entries: Record<string, string> = {};
    const existingOAuthToken = pickDefault(defaults, [
      "YANDEX_TOKEN",
      "YANDEX_DIRECT_TOKEN",
      "YANDEX_METRIKA_TOKEN",
      "YANDEX_WEBMASTER_OAUTH_TOKEN",
      "YANDEX_WEBMASTER_TOKEN",
      "YANDEX_TRACKER_TOKEN"
    ]);
    const refreshOAuth = existingOAuthToken
      ? await askYesNo(rl, `🔁 Нашел существующий OAuth token ${redact(existingOAuthToken)}. Перевыпустить?`, false)
      : true;

    if (existingOAuthToken && !refreshOAuth) {
      spreadOAuthToken(entries, existingOAuthToken);
    } else {
      await openStep("1/5 Создай OAuth app", OAUTH_APP_URL, [
        `Название: Yandex Ultimate MCP`,
        "Тип: Для доступа к API или отладки.",
        `Redirect URI для понятного ручного режима: ${MANUAL_OAUTH_REDIRECT_URI}`,
        `Опционально для auto-capture добавь еще: ${capture.redirectUri}`,
        "Доступ к данным: Metrika read/write, Direct direct:api, Webmaster все найденные, Tracker read/write.",
        "Для org-логинов Metrika/Direct добавь passport:business."
      ]);

      const clientId = (await ask(rl, "🔑 Вставь Yandex OAuth ClientID", "после создания app скопируй ClientID сюда; Enter = вставить token вручную")).trim();
      if (clientId) {
        const useLocalRedirect = await askYesNo(
          rl,
          `🧲 Ты ДОБАВИЛ в OAuth app именно localhost Redirect URI: ${capture.redirectUri}?`,
          false
        );
        if (useLocalRedirect) {
          const authUrl = makeOAuthUrl(clientId, capture.redirectUri);
          await openStep("2/5 Авторизация с auto-capture", authUrl, [
            "Wizard уже ждет callback локально.",
            "После разрешения доступа browser вернется на localhost, token поймается сам.",
            "Если Yandex ругается на redirect_uri — ответь 'нет' на предыдущий вопрос и используй fallback."
          ]);
          const token = await capture.waitForToken(120_000);
          if (token) {
            await saveOAuthToken(rl, entries, token);
          } else {
            console.log("⏳ Автопоимка не сработала за 2 минуты — включаю ручной fallback.");
            await promptManualOAuth(rl, entries);
          }
        } else {
          const authUrl = makeOAuthUrl(clientId);
          await openStep("2/5 Официальная ручная авторизация", authUrl, [
            `У приложения должен быть Redirect URI: ${MANUAL_OAUTH_REDIRECT_URI}`,
            "После кнопки Разрешить скопируй весь URL из адресной строки или сам access_token.",
            "Это самый надежный режим, если браузер уже залогинен через Helium/cookies."
          ]);
          await promptManualOAuth(rl, entries);
        }
      } else {
        console.log("↪️  ClientID пропущен — OAuth token можно вставить вручную.");
        await promptManualOAuth(rl, entries);
      }
    }

    await openStep("3/5 Direct login / API request", DIRECT_API_DOC_URL, [
      "Direct API требует direct:api scope в OAuth app и отдельную заявку на API-доступ.",
      "Если заявка уже создана — просто проверь client login ниже.",
      "Если Direct/Wordstat не нужен — просто Enter.",
      "YANDEX_CLIENT_LOGIN — логин клиента/аккаунта Direct, НЕ token."
    ]);
    await openMaybe("🧾 Открываю Direct API requests", DIRECT_API_REQUEST_URL);
    await askAndSave(rl, entries, "🏷️  YANDEX_CLIENT_LOGIN", "логин клиента/аккаунта Direct, НЕ токен", "YANDEX_CLIENT_LOGIN", defaults.YANDEX_CLIENT_LOGIN);

    console.log(box("4/5 Tracker / Cloud / Search", [
      "Tracker просит org id.",
      "Включенный yandex-search-mcp = Yandex Cloud Search API.",
      "YC_* defaults wizard берет из .env.local или `yc config list`, если CLI установлен.",
      "Поиск для сайта — отдельный продукт: developer.tech key + site.yandex.ru.",
      "Если не используешь — Enter на полях ниже."
    ]));
    await openMaybe("☁️  Открываю Yandex Cloud console", CLOUD_CONSOLE_URL);
    await askAndSave(rl, entries, "🏢 YANDEX_TRACKER_ORG_ID", "org/cloud id для Tracker", "YANDEX_TRACKER_ORG_ID", pickDefault(defaults, ["YANDEX_TRACKER_ORG_ID", "YANDEX_ORG_ID", "YANDEX_CLOUD_ORG_ID"]));
    await askAndSave(rl, entries, "☁️  YC_OAUTH_TOKEN", "Cloud OAuth token; Enter = найденный yc/.env default", "YC_OAUTH_TOKEN", pickDefault(defaults, ["YC_OAUTH_TOKEN", "YANDEX_CLOUD_TOKEN"]));
    if (entries.YC_OAUTH_TOKEN && !entries.YANDEX_CLOUD_TOKEN) entries.YANDEX_CLOUD_TOKEN = entries.YC_OAUTH_TOKEN;
    await askAndSave(rl, entries, "☁️  YC_CLOUD_ID", "cloud id из yc config/console; можно пропустить", "YC_CLOUD_ID", pickDefault(defaults, ["YC_CLOUD_ID", "YANDEX_CLOUD_ID"]));
    await askAndSave(rl, entries, "📁 YC_FOLDER_ID", "folder id для Cloud; нужен и для Cloud Search", "YC_FOLDER_ID", pickDefault(defaults, ["YC_FOLDER_ID", "YANDEX_FOLDER_ID", "YANDEX_SEARCH_FOLDER_ID"]));
    await askAndSave(rl, entries, "🔎 YANDEX_SEARCH_API_KEY", "API key service account для Yandex Cloud Search API", "YANDEX_SEARCH_API_KEY", defaults.YANDEX_SEARCH_API_KEY);
    await askAndSave(rl, entries, "🔎 YANDEX_FOLDER_ID", "folder id для yandex-search-mcp; Enter = использовать YC_FOLDER_ID", "YANDEX_FOLDER_ID", pickDefault(entries, ["YC_FOLDER_ID"]) ?? pickDefault(defaults, ["YANDEX_FOLDER_ID", "YC_FOLDER_ID"]));
    if (!entries.YANDEX_FOLDER_ID && entries.YC_FOLDER_ID) entries.YANDEX_FOLDER_ID = entries.YC_FOLDER_ID;
    if (!entries.YANDEX_SEARCH_FOLDER_ID && entries.YANDEX_FOLDER_ID) entries.YANDEX_SEARCH_FOLDER_ID = entries.YANDEX_FOLDER_ID;

    console.log(box("4b/5 Поиск для сайта — справочно", [
      "Твой линк относится к API Яндекс.Поиска для сайта, это не Cloud Search MCP.",
      "Нужен key в Кабинете разработчика и подключение key к конкретному поиску на site.yandex.ru.",
      "Пока это не отдельный включенный MCP-модуль, но wizard открывает правильный маршрут."
    ]));
    await openMaybe("🔎 Документация Поиска для сайта", SITE_SEARCH_ACCESS_URL);
    await openMaybe("🔎 Мои поиски site.yandex.ru", SITE_SEARCH_MY_SEARCHES_URL);

    console.log(box("5/5 Maps", [
      "Для Maps нужен API key из developer.tech.yandex.ru.",
      "Если Maps не нужен — Enter."
    ]));
    await openMaybe("🗺️  Открываю кабинет ключей Maps", MAPS_KEYS_URL);
    await askAndSave(rl, entries, "🗺️  YANDEX_MAPS_API_KEY", "ключ Maps/Geocoder/Routing", "YANDEX_MAPS_API_KEY", defaults.YANDEX_MAPS_API_KEY);
    await askAndSave(rl, entries, "🖼️  YANDEX_MAPS_STATIC_API_KEY", "опционально, static maps key; Enter = использовать основной Maps key", "YANDEX_MAPS_STATIC_API_KEY", defaults.YANDEX_MAPS_STATIC_API_KEY);
    if (!entries.YANDEX_MAPS_STATIC_API_KEY && entries.YANDEX_MAPS_API_KEY) entries.YANDEX_MAPS_STATIC_API_KEY = entries.YANDEX_MAPS_API_KEY;

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
    await capture.close();
  }
}

async function saveOAuthToken(rl: ReturnType<typeof createInterface>, entries: Record<string, string>, token: string): Promise<void> {
  console.log(`✅ access_token пойман: ${redact(token)}`);
  const spread = await askYesNo(rl, "✨ Разложить этот OAuth token по YANDEX_TOKEN/METRIKA/DIRECT/WEBMASTER/TRACKER?", true);
  if (spread) spreadOAuthToken(entries, token);
  else entries.YANDEX_TOKEN = token;
}

function spreadOAuthToken(entries: Record<string, string>, token: string): void {
  entries.YANDEX_TOKEN = token;
  entries.YANDEX_METRIKA_TOKEN = token;
  entries.YANDEX_DIRECT_TOKEN = token;
  entries.YANDEX_WEBMASTER_TOKEN = token;
  entries.YANDEX_WEBMASTER_OAUTH_TOKEN = token;
  entries.YANDEX_TRACKER_TOKEN = token;
}

async function promptManualOAuth(rl: ReturnType<typeof createInterface>, entries: Record<string, string>): Promise<void> {
  const rawOAuth = (await ask(
    rl,
    "📥 Вставь callback URL или чистый access_token",
    "подходит полный URL вида https://...#access_token=...; wizard сам вытащит token"
  )).trim();
  const token = extractAccessToken(rawOAuth);
  if (token) await saveOAuthToken(rl, entries, token);
  else if (rawOAuth) console.log("⚠️  Не нашел access_token. OAuth token не сохранен.");
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

export function makeOAuthUrl(clientId: string, redirectUri?: string): string {
  const url = new URL("https://oauth.yandex.ru/authorize");
  url.searchParams.set("response_type", "token");
  url.searchParams.set("client_id", clientId);
  if (redirectUri) url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}

export async function startOAuthCapture(): Promise<{
  redirectUri: string;
  waitForToken: (timeoutMs: number) => Promise<string | undefined>;
  close: () => Promise<void>;
}> {
  let resolvedToken: string | undefined;
  let resolveToken: ((token: string) => void) | undefined;
  const tokenPromise = new Promise<string>((resolve) => {
    resolveToken = resolve;
  });

  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url?.startsWith("/callback")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(callbackHtml());
      return;
    }

    if (req.method === "POST" && req.url === "/capture") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const token = typeof parsed.access_token === "string" ? parsed.access_token : undefined;
          if (token) {
            resolvedToken = token;
            resolveToken?.(token);
          }
          res.writeHead(204);
          res.end();
        } catch {
          res.writeHead(400);
          res.end("bad json");
        }
      });
      return;
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });

  const port = await listen(server, Number(process.env.ULTIMATE_AUTH_PORT ?? DEFAULT_AUTH_PORT));
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  return {
    redirectUri,
    waitForToken: async (timeoutMs: number) => {
      if (resolvedToken) return resolvedToken;
      return withTimeout(tokenPromise, timeoutMs).catch(() => undefined);
    },
    close: async () => closeServer(server)
  };
}

function listen(server: Server, preferredPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryListen = (port: number, attemptsLeft: number) => {
      const onError = (error: NodeJS.ErrnoException) => {
        server.off("error", onError);
        server.off("listening", onListening);
        if (error.code === "EADDRINUSE" && attemptsLeft > 0) tryListen(port + 1, attemptsLeft - 1);
        else reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        const address = server.address();
        resolve(typeof address === "object" && address ? address.port : port);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "127.0.0.1");
    };
    tryListen(preferredPort, 20);
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

function callbackHtml(): string {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Yandex Ultimate MCP OAuth</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f7f5f1;color:#111;display:grid;place-items:center;min-height:100vh;margin:0}
    .card{max-width:680px;background:white;border-radius:28px;padding:36px;box-shadow:0 24px 80px rgba(0,0,0,.12)}
    h1{margin:0 0 12px;font-size:34px} p{font-size:18px;line-height:1.5}.ok{color:#18a058}.bad{color:#d93025} code{background:#f1f1f1;padding:2px 6px;border-radius:6px}
  </style>
</head>
<body>
  <main class="card">
    <h1>🚀 Yandex Ultimate MCP</h1>
    <p id="status">Ловлю OAuth token…</p>
    <p>Если всё ок, можно вернуться в терминал.</p>
  </main>
  <script>
    const params = new URLSearchParams(location.hash.slice(1));
    const token = params.get('access_token');
    const status = document.getElementById('status');
    if (!token) {
      status.className = 'bad';
      status.innerHTML = 'Не нашел <code>access_token</code> в URL. Вернись в терминал и вставь callback URL вручную.';
    } else {
      fetch('/capture', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ access_token: token }) })
        .then(() => { status.className = 'ok'; status.textContent = '✅ Token пойман и отправлен wizard. Можно закрыть вкладку.'; })
        .catch(() => { status.className = 'bad'; status.textContent = 'Не смог отправить token в wizard. Скопируй весь URL из адресной строки в терминал.'; });
    }
  </script>
</body>
</html>`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function loadAuthDefaults(envFile = ENV_FILE): Promise<Record<string, string>> {
  const entries = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
  const yc = await readYcConfig();
  return {
    ...Object.fromEntries(Object.entries(yc).filter(([, value]) => Boolean(value))),
    ...Object.fromEntries(Object.entries(entries).filter(([, value]) => Boolean(value?.trim())))
  };
}

export function parseEnv(content: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(ENV_KEY_RE);
    if (match) entries[match[1]] = unquoteEnv(match[2].trim());
  }
  return entries;
}

export function serializeEnv(existing: string, entries: Record<string, string>, now = new Date()): string {
  const pending = new Set(Object.keys(entries));
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const line of existing ? existing.split(/\r?\n/) : []) {
    const match = line.match(ENV_KEY_RE);
    if (match && Object.prototype.hasOwnProperty.call(entries, match[1])) {
      if (!seen.has(match[1])) {
        lines.push(`${match[1]}=${escapeEnv(entries[match[1]])}`);
        seen.add(match[1]);
        pending.delete(match[1]);
      }
      continue;
    }
    lines.push(line);
  }

  if (pending.size) {
    if (lines.length && lines[lines.length - 1].trim()) lines.push("");
    lines.push(`# Added by yandex-ultimate-mcp auth wizard at ${now.toISOString()}`);
    for (const key of pending) lines.push(`${key}=${escapeEnv(entries[key])}`);
  }

  return `${lines.join("\n").replace(/\n*$/, "")}\n`;
}

async function readYcConfig(): Promise<Record<string, string>> {
  const output = await captureCommand("yc", ["config", "list"]);
  if (!output) return {};

  const raw: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([a-z-]+):\s*(.+)$/);
    if (match) raw[match[1]] = match[2].trim();
  }

  const entries: Record<string, string> = {};
  if (raw.token) {
    entries.YC_OAUTH_TOKEN = raw.token;
    entries.YANDEX_CLOUD_TOKEN = raw.token;
  }
  if (raw["cloud-id"]) entries.YC_CLOUD_ID = raw["cloud-id"];
  if (raw["folder-id"]) {
    entries.YC_FOLDER_ID = raw["folder-id"];
    entries.YANDEX_FOLDER_ID = raw["folder-id"];
    entries.YANDEX_SEARCH_FOLDER_ID = raw["folder-id"];
  }
  return entries;
}

function captureCommand(command: string, args: string[]): Promise<string | undefined> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"] });
    let stdout = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("error", () => resolve(undefined));
    child.on("exit", (code) => resolve(code === 0 ? stdout : undefined));
  });
}

function writeEnv(entries: Record<string, string>): void {
  const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  writeFileSync(ENV_FILE, serializeEnv(existing, entries));
}

async function askAndSave(
  rl: ReturnType<typeof createInterface>,
  entries: Record<string, string>,
  label: string,
  hint: string,
  key: string,
  defaultValue?: string
): Promise<void> {
  const fullHint = defaultValue ? `${hint}; Enter = оставить ${redact(defaultValue)}` : hint;
  const value = (await ask(rl, label, fullHint)).trim();
  if (value) entries[key] = extractAccessToken(value) ?? value;
  else if (defaultValue) entries[key] = defaultValue;
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

function pickDefault(entries: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = entries[key];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

async function openStep(title: string, url: string, lines: string[]): Promise<void> {
  console.log(box(title, [...lines, `URL: ${url}`]));
  await openMaybe(title, url);
}

async function openMaybe(label: string, url: string): Promise<void> {
  if (process.env.ULTIMATE_NO_OPEN === "1") {
    console.log(`↪️  ${label}: ${url}`);
    return;
  }
  const ok = await openExternal(url);
  console.log(ok ? `🌐 ${label}: открыл в браузере` : `🌐 ${label}: открой вручную ${url}`);
}

function openExternal(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const os = platform();
    const browserApp = process.env.ULTIMATE_BROWSER_APP?.trim();
    const command = os === "darwin" ? "open" : os === "win32" ? "cmd" : "xdg-open";
    const args = os === "darwin" && browserApp
      ? ["-a", browserApp, url]
      : os === "win32"
        ? ["/c", "start", "", url]
        : [url];
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.on("error", () => resolve(false));
    child.on("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

function printHero(redirectUri: string): void {
  console.log(box("🚀 Yandex Ultimate MCP — красивый auth wizard", [
    "Без скрейпа логина/пароля: открываем официальные страницы и ловим redirect локально.",
    `Официальный ручной Redirect URI: ${MANUAL_OAUTH_REDIRECT_URI}`,
    `Redirect URI для auto-capture: ${redirectUri}`,
    "Если хочешь открыть именно Helium: ULTIMATE_BROWSER_APP=Helium npm run auth",
    "OAuth app type: Для доступа к API или отладки.",
    "Scopes: metrika:read/write, direct:api, webmaster*, tracker:read/write.",
    "YANDEX_CLIENT_LOGIN — это логин Direct, а не токен.",
    "Секреты пишем в .env.local, в git они не попадут."
  ]));
}

function box(title: string, lines: string[]): string {
  const width = Math.max(stripAnsi(title).length, ...lines.map((line) => stripAnsi(line).length)) + 4;
  const top = `╭${"─".repeat(width)}╮`;
  const bottom = `╰${"─".repeat(width)}╯`;
  const body = [`│ ${title}${" ".repeat(width - stripAnsi(title).length - 1)}│`];
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

function unquoteEnv(value: string): string {
  if (!value) return value;
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

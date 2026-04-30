import type { EnvMap, ModuleDefinition, ModuleStatus, RequiredEnvGroup } from "./types.js";

const pick = (env: EnvMap, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
};

const baseEnv = (env: EnvMap): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const key of ["PATH", "HOME", "USERPROFILE", "TMPDIR", "TEMP", "TMP", "NODE_OPTIONS", "PYTHONPATH"]) {
    const value = env[key];
    if (value) out[key] = value;
  }
  return out;
};

const withPairs = (env: EnvMap, pairs: Record<string, string | undefined>): Record<string, string> => {
  const out = baseEnv(env);
  for (const [key, value] of Object.entries(pairs)) {
    if (value && value.trim()) out[key] = value.trim();
  }
  return out;
};

export const MODULES: ModuleDefinition[] = [
  {
    id: "stegyan",
    title: "Yandex Direct + Metrika + Wordstat mega-pack",
    description: "Самый жирный найденный MCP-пакет: Direct, Metrika и Wordstat; детектировано ~125 tools.",
    command: "npx",
    args: ["-y", "@stegyan/yandex-mcp@latest"],
    priority: 10,
    expectedTools: 125,
    requiredEnv: [
      { label: "Yandex OAuth token", anyOf: ["YANDEX_TOKEN", "YANDEX_DIRECT_TOKEN", "YANDEX_METRIKA_TOKEN"], note: "Direct/Metrika/Wordstat scopes depend on your app permissions." }
    ],
    optionalEnv: ["YANDEX_CLIENT_LOGIN", "YANDEX_USE_SANDBOX"],
    docsUrl: "https://www.npmjs.com/package/@stegyan/yandex-mcp",
    packageName: "@stegyan/yandex-mcp",
    license: "MIT",
    sourceUrl: "https://github.com/stegyan/yandex-mcp",
    categories: ["direct", "metrika", "wordstat", "ads", "analytics"],
    env: (env: EnvMap) => withPairs(env, {
      YANDEX_TOKEN: pick(env, ["YANDEX_TOKEN", "YANDEX_DIRECT_TOKEN", "YANDEX_METRIKA_TOKEN"]),
      YANDEX_CLIENT_LOGIN: pick(env, ["YANDEX_CLIENT_LOGIN", "YANDEX_DIRECT_CLIENT_LOGIN"]),
      YANDEX_USE_SANDBOX: pick(env, ["YANDEX_USE_SANDBOX"])
    })
  },
  {
    id: "webmaster",
    title: "Yandex Webmaster reliable pack",
    description: "Надежный npm-pack Webmaster из altrr2/yandex-tools-mcp: диагностика, индексация, SQI, ссылки, sitemap, recrawl.",
    command: "npx",
    args: ["-y", "yandex-webmaster-mcp@latest"],
    priority: 20,
    expectedTools: 24,
    requiredEnv: [
      { label: "Webmaster OAuth token", anyOf: ["YANDEX_WEBMASTER_OAUTH_TOKEN", "YANDEX_WEBMASTER_TOKEN", "YANDEX_TOKEN"] }
    ],
    optionalEnv: ["YANDEX_WEBMASTER_HOST_URL"],
    docsUrl: "https://github.com/altrr2/yandex-tools-mcp/tree/main/packages/yandex-webmaster-mcp",
    license: "MIT",
    sourceUrl: "https://github.com/altrr2/yandex-tools-mcp",
    categories: ["webmaster", "seo", "indexing"],
    env: (env: EnvMap) => withPairs(env, {
      YANDEX_WEBMASTER_OAUTH_TOKEN: pick(env, ["YANDEX_WEBMASTER_OAUTH_TOKEN", "YANDEX_WEBMASTER_TOKEN", "YANDEX_TOKEN"]),
      YANDEX_WEBMASTER_HOST_URL: pick(env, ["YANDEX_WEBMASTER_HOST_URL"])
    })
  },
  {
    id: "tracker",
    title: "Yandex Tracker",
    description: "Issues, queues, comments, worklogs, attachments, users and metadata. NPM MCP package with ~21 tools.",
    command: "npx",
    args: ["-y", "yandex-tracker-mcp@latest"],
    priority: 30,
    expectedTools: 21,
    requiredEnv: [
      { label: "Tracker OAuth token", anyOf: ["YANDEX_TRACKER_TOKEN", "YANDEX_TRACKER_OAUTH_TOKEN", "YANDEX_TOKEN"] },
      { label: "Tracker org/cloud id", anyOf: ["YANDEX_TRACKER_ORG_ID", "YANDEX_ORG_ID", "YANDEX_CLOUD_ORG_ID"] }
    ],
    docsUrl: "https://www.npmjs.com/package/yandex-tracker-mcp",
    packageName: "yandex-tracker-mcp",
    license: "MIT",
    sourceUrl: "https://github.com/brekhov-ilya/yandex-mcp-server",
    categories: ["tracker", "tasks", "project-management"],
    env: (env: EnvMap) => withPairs(env, {
      YANDEX_TRACKER_TOKEN: pick(env, ["YANDEX_TRACKER_TOKEN", "YANDEX_TRACKER_OAUTH_TOKEN", "YANDEX_TOKEN"]),
      YANDEX_TRACKER_ORG_ID: pick(env, ["YANDEX_TRACKER_ORG_ID", "YANDEX_ORG_ID", "YANDEX_CLOUD_ORG_ID"])
    })
  },
  {
    id: "cloud",
    title: "Yandex Cloud",
    description: "Compute, VPC, Object Storage, PostgreSQL, AI, Kubernetes, Serverless and Security helpers (~31 tools).",
    command: "npx",
    args: ["-y", "yandex-cloud-mcp@latest"],
    priority: 40,
    expectedTools: 31,
    requiredEnv: [
      { label: "Yandex Cloud token", anyOf: ["YC_OAUTH_TOKEN", "YANDEX_CLOUD_TOKEN", "YANDEX_TOKEN"] },
      { label: "Folder ID", anyOf: ["YC_FOLDER_ID", "YANDEX_FOLDER_ID"] }
    ],
    optionalEnv: ["YC_CLOUD_ID", "YANDEX_CLOUD_ID"],
    docsUrl: "https://www.npmjs.com/package/yandex-cloud-mcp",
    packageName: "yandex-cloud-mcp",
    license: "MIT",
    sourceUrl: "https://github.com/p141592/yandex_cloud_mcp",
    categories: ["cloud", "infra", "ai", "storage"],
    env: (env: EnvMap) => withPairs(env, {
      YC_OAUTH_TOKEN: pick(env, ["YC_OAUTH_TOKEN", "YANDEX_CLOUD_TOKEN", "YANDEX_TOKEN"]),
      YC_FOLDER_ID: pick(env, ["YC_FOLDER_ID", "YANDEX_FOLDER_ID"]),
      YC_CLOUD_ID: pick(env, ["YC_CLOUD_ID", "YANDEX_CLOUD_ID"])
    })
  },
  {
    id: "maps",
    title: "Yandex Maps",
    description: "Geocoding, reverse geocoding, organizations search, routing, route matrix, static maps (~10 tools).",
    command: "npx",
    args: ["-y", "@theyahia/yandex-maps-mcp@latest"],
    priority: 50,
    expectedTools: 10,
    requiredEnv: [
      { label: "Maps API key", anyOf: ["YANDEX_MAPS_API_KEY", "YANDEX_GEOCODER_API_KEY", "YANDEX_TOKEN"] }
    ],
    optionalEnv: ["YANDEX_MAPS_STATIC_API_KEY"],
    docsUrl: "https://www.npmjs.com/package/@theyahia/yandex-maps-mcp",
    packageName: "@theyahia/yandex-maps-mcp",
    license: "MIT",
    sourceUrl: "https://github.com/theYahia/yandex-maps-mcp",
    categories: ["maps", "geocoding", "routing"],
    env: (env: EnvMap) => withPairs(env, {
      YANDEX_MAPS_API_KEY: pick(env, ["YANDEX_MAPS_API_KEY", "YANDEX_GEOCODER_API_KEY", "YANDEX_TOKEN"]),
      YANDEX_MAPS_STATIC_API_KEY: pick(env, ["YANDEX_MAPS_STATIC_API_KEY", "YANDEX_MAPS_API_KEY"])
    })
  },
  {
    id: "search",
    title: "Yandex Search",
    description: "Yandex Cloud Search API MCP from altrr2/yandex-tools-mcp; web-search bridge (not Site Search).",
    command: "npx",
    args: ["-y", "yandex-search-mcp@latest"],
    priority: 60,
    expectedTools: 1,
    requiredEnv: [
      { label: "Search API key", anyOf: ["YANDEX_SEARCH_API_KEY"] },
      { label: "Search folder id", anyOf: ["YANDEX_FOLDER_ID", "YANDEX_SEARCH_FOLDER_ID", "YC_FOLDER_ID"] }
    ],
    docsUrl: "https://github.com/altrr2/yandex-tools-mcp/tree/main/packages/yandex-search-mcp",
    packageName: "yandex-search-mcp",
    license: "MIT",
    sourceUrl: "https://github.com/altrr2/yandex-tools-mcp",
    categories: ["search", "web"],
    env: (env: EnvMap) => withPairs(env, {
      YANDEX_SEARCH_API_KEY: pick(env, ["YANDEX_SEARCH_API_KEY"]),
      YANDEX_SEARCH_FOLDER_ID: pick(env, ["YANDEX_SEARCH_FOLDER_ID", "YANDEX_FOLDER_ID", "YC_FOLDER_ID"]),
      YANDEX_FOLDER_ID: pick(env, ["YANDEX_FOLDER_ID", "YANDEX_SEARCH_FOLDER_ID", "YC_FOLDER_ID"])
    })
  },
  {
    id: "cloud_docs",
    title: "Yandex Cloud Docs",
    description: "Поиск и чтение документации Yandex Cloud через MCP; полезно как справочник рядом с infra tools.",
    command: "npx",
    args: ["-y", "@doctorai/yandex-cloud-docs-mcp-server@latest"],
    priority: 70,
    expectedTools: 11,
    requiredEnv: [],
    docsUrl: "https://www.npmjs.com/package/@doctorai/yandex-cloud-docs-mcp-server",
    packageName: "@doctorai/yandex-cloud-docs-mcp-server",
    license: "MIT",
    sourceUrl: "https://www.npmjs.com/package/@doctorai/yandex-cloud-docs-mcp-server",
    categories: ["docs", "cloud"],
    enabledByDefault: false,
    env: (env: EnvMap) => baseEnv(env)
  }
].sort((a, b) => a.priority - b.priority);

export function missingForGroup(env: EnvMap, group: RequiredEnvGroup): string | undefined {
  if (group.allOf?.length) {
    const missing = group.allOf.filter((key) => !env[key]?.trim());
    return missing.length ? `${group.label}: ${missing.join(", ")}` : undefined;
  }
  if (group.anyOf?.length) {
    return group.anyOf.some((key) => env[key]?.trim()) ? undefined : `${group.label}: one of ${group.anyOf.join(" | ")}`;
  }
  return undefined;
}

export function getModuleStatuses(env: EnvMap = process.env): ModuleStatus[] {
  const enableOnly = parseCsv(env.ULTIMATE_ENABLE_MODULES);
  const disabled = new Set(parseCsv(env.ULTIMATE_DISABLE_MODULES));
  const disableChildren = isTruthy(env.ULTIMATE_DISABLE_CHILDREN);

  return MODULES.map((mod) => {
    const missing = mod.requiredEnv.map((group) => missingForGroup(env, group)).filter((value): value is string => Boolean(value));
    const configured = missing.length === 0;
    const selected = enableOnly.length ? enableOnly.includes(mod.id) : mod.enabledByDefault !== false;
    const enabled = !disableChildren && selected && !disabled.has(mod.id) && configured;
    return {
      id: mod.id,
      title: mod.title,
      configured,
      enabled,
      expectedTools: mod.expectedTools,
      missing,
      command: mod.command,
      args: mod.args,
      packageName: mod.packageName,
      sourceUrl: mod.sourceUrl,
      license: mod.license,
      categories: mod.categories
    };
  });
}

export function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isTruthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

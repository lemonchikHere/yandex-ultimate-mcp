export type EnvMap = Record<string, string | undefined>;

export type RequiredEnvGroup = {
  label: string;
  anyOf?: string[];
  allOf?: string[];
  note?: string;
};

export type ModuleDefinition = {
  id: string;
  title: string;
  description: string;
  command: string;
  args: string[];
  priority: number;
  expectedTools?: number;
  requiredEnv: RequiredEnvGroup[];
  optionalEnv?: string[];
  docsUrl: string;
  packageName?: string;
  license: string;
  sourceUrl: string;
  categories: string[];
  env: (processEnv: EnvMap) => Record<string, string>;
  enabledByDefault?: boolean;
};

export type ModuleStatus = {
  id: string;
  title: string;
  configured: boolean;
  enabled: boolean;
  expectedTools?: number;
  missing: string[];
  command: string;
  args: string[];
  packageName?: string;
  sourceUrl: string;
  license: string;
  categories: string[];
  lastError?: string;
  listedTools?: number;
};

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface Config {
  baseUrl: string;
  token: string;
  allowWrite: boolean;
}

const DEFAULT_ETAPI_URL = "http://127.0.0.1:4318";
const DEFAULT_CONFIG_FILE = fileURLToPath(
  new URL("../ygdria-mcp.ini", import.meta.url),
);

interface IniConfig {
  token?: string;
  url?: string;
  allowWrite?: string;
}

export function parseIni(text: string): IniConfig {
  const result: IniConfig = {};
  let section = "";

  for (const [index, sourceLine] of text.split(/\r?\n/).entries()) {
    const line = sourceLine.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) {
      continue;
    }
    if (line.startsWith("[") && line.endsWith("]")) {
      section = line.slice(1, -1).trim().toLowerCase();
      continue;
    }

    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new Error(`Invalid INI syntax on line ${index + 1}.`);
    }
    if (section !== "etapi") {
      continue;
    }

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "token") result.token = value;
    if (key === "url" || key === "baseurl") result.url = value;
    if (key === "allowwrite") result.allowWrite = value;
  }

  return result;
}

function loadIni(path: string): IniConfig {
  if (!existsSync(path)) return {};
  try {
    return parseIni(readFileSync(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read Ygdria INI config at ${path}: ${message}`);
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const configFile = env.YGDRIA_CONFIG_FILE?.trim() || DEFAULT_CONFIG_FILE;
  const ini = loadIni(configFile);
  const token = env.YGDRIA_ETAPI_TOKEN?.trim() || ini.token?.trim();
  if (!token) {
    throw new Error(
      `An ETAPI token is required. Set YGDRIA_ETAPI_TOKEN or fill in ${configFile}.`,
    );
  }

  const rawUrl =
    env.YGDRIA_ETAPI_URL?.trim() || ini.url?.trim() || DEFAULT_ETAPI_URL;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("YGDRIA_ETAPI_URL must be a valid absolute HTTP(S) URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("YGDRIA_ETAPI_URL must use http or https.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      "YGDRIA_ETAPI_URL must not contain credentials, a query string, or a fragment.",
    );
  }
  if (url.pathname !== "/") {
    throw new Error(
      "YGDRIA_ETAPI_URL must be an origin only (for example http://127.0.0.1:4318); paths are not allowed.",
    );
  }

  return {
    baseUrl: url.origin,
    token,
    allowWrite:
      (env.YGDRIA_ALLOW_WRITE !== undefined
        ? env.YGDRIA_ALLOW_WRITE
        : ini.allowWrite
      )
        ?.trim()
        .toLowerCase() === "true",
  };
}

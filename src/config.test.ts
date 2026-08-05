import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadConfig, parseIni } from "./config.js";

test("loadConfig defaults to localhost and read-only", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "ygdria-mcp-test-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  assert.deepEqual(loadConfig({
    YGDRIA_ETAPI_TOKEN: " token ",
    YGDRIA_CONFIG_FILE: join(directory, "missing.ini"),
  }), {
    baseUrl: "http://127.0.0.1:4318",
    token: "token",
    allowWrite: false,
  });
});

test("loadConfig requires explicit true to enable writes", () => {
  assert.equal(
    loadConfig({
      YGDRIA_ETAPI_TOKEN: "token",
      YGDRIA_ALLOW_WRITE: "TRUE",
    }).allowWrite,
    true,
  );
});

test("loadConfig rejects base URLs containing an API path", () => {
  assert.throws(
    () =>
      loadConfig({
        YGDRIA_ETAPI_TOKEN: "token",
        YGDRIA_ETAPI_URL: "http://localhost:4318/api/v1",
      }),
    /origin only/,
  );
});

test("parseIni reads the ETAPI section without altering token characters", () => {
  assert.deepEqual(
    parseIni(`
      ; local configuration
      [etapi]
      token = token-with-=characters
      url = http://localhost:4318
      allowWrite = true
    `),
    {
      token: "token-with-=characters",
      url: "http://localhost:4318",
      allowWrite: "true",
    },
  );
});

test("loadConfig reads token and settings from an INI file", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "ygdria-mcp-test-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const configPath = join(directory, "ygdria-mcp.ini");
  writeFileSync(
    configPath,
    "[etapi]\ntoken = from-ini\nurl = http://localhost:4318\nallowWrite = true\n",
    "utf8",
  );

  assert.deepEqual(loadConfig({ YGDRIA_CONFIG_FILE: configPath }), {
    baseUrl: "http://localhost:4318",
    token: "from-ini",
    allowWrite: true,
  });
});

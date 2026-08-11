import { mkdtemp, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";
import { generateVagueFile } from "../generator.js";
import { loadOpenAPISchemaNames } from "../parser.js";
import { generateData } from "../vague.js";

describe("Vague data generation", () => {
  it("converts an OpenAPI schema into generated JSON data", async () => {
    const specPath = resolve("src/__tests__/fixtures/openapi.json");
    const schemaNames = await loadOpenAPISchemaNames(specPath);
    expect(schemaNames).toEqual(["User"]);

    const directory = await mkdtemp(join(tmpdir(), "weavr-data-generator-"));
    const vaguePath = join(directory, "fixtures.vague");
    const jsonPath = join(directory, "fixtures.json");
    const source = generateVagueFile({
      specPath,
      schemaNames,
      datasetName: "Fixtures",
      counts: { User: 2 },
    });

    await writeFile(vaguePath, source, "utf-8");
    const data = await generateData(vaguePath, jsonPath, { seed: 42 });

    expect(data.users).toHaveLength(2);
    const user = data.users[0] as Record<string, unknown>;
    expect(user).toEqual({
      name: expect.any(String),
      active: expect.any(Boolean),
      email: expect.stringMatching(/^[^@]+@[^@]+\.[^@]+$/),
      code: expect.stringMatching(/^[A-Z]{6}$/),
      score: expect.any(Number),
      role: expect.stringMatching(/^(ADMIN|MEMBER)$/),
      tags: [expect.any(String), expect.any(String)],
      profile: { nickname: expect.any(String) },
    });
    expect(user.score as number).toBeGreaterThanOrEqual(10);
    expect(user.score as number).toBeLessThanOrEqual(20);
    expect(JSON.parse(await readFile(jsonPath, "utf-8"))).toEqual(data);
  });

  it("loads schemas from YAML OpenAPI documents", async () => {
    const directory = await mkdtemp(join(tmpdir(), "weavr-data-generator-"));
    const specPath = join(directory, "openapi.yaml");

    await writeFile(
      specPath,
      [
        "openapi: 3.1.0",
        "info:",
        "  title: YAML API",
        "  version: 1.0.0",
        "paths: {}",
        "components:",
        "  schemas:",
        "    User:",
        "      type: object",
        "      properties:",
        "        name:",
        "          type: string",
      ].join("\n"),
      "utf-8"
    );

    await expect(loadOpenAPISchemaNames(specPath)).resolves.toEqual(["User"]);
  });

  it("rejects invalid OpenAPI documents", async () => {
    const directory = await mkdtemp(join(tmpdir(), "weavr-data-generator-"));
    const specPath = join(directory, "invalid.json");
    await writeFile(specPath, JSON.stringify({ components: { schemas: {} } }), "utf-8");

    await expect(loadOpenAPISchemaNames(specPath)).rejects.toThrow(/OpenAPI/i);
  });
});

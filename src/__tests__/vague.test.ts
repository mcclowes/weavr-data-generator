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
    expect(data.users[0]).toEqual({ name: expect.any(String), active: expect.any(Boolean) });
    expect(JSON.parse(await readFile(jsonPath, "utf-8"))).toEqual(data);
  });
});

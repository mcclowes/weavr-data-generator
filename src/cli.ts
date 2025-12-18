#!/usr/bin/env node

import { writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { loadOpenAPISpec } from "./parser.js";
import { generateVagueFile } from "./generator.js";
import {
  promptForSchemas,
  promptForCounts,
  promptForOutputPath,
  promptForDatasetName,
} from "./prompts.js";

async function main() {
  const args = process.argv.slice(2);
  const specPath = args[0] ?? "./embedder.json";

  console.log("Weavr Data Generator\n");
  console.log(`Loading OpenAPI spec from: ${specPath}\n`);

  try {
    const spec = await loadOpenAPISpec(resolve(specPath));
    console.log(`Loaded: ${spec.info.title} v${spec.info.version}\n`);

    // Interactive prompts
    const selectedSchemas = await promptForSchemas(spec);

    if (selectedSchemas.length === 0) {
      console.log("No schemas selected. Exiting.");
      process.exit(0);
    }

    console.log(`\nSelected ${selectedSchemas.length} schemas\n`);

    const counts = await promptForCounts(selectedSchemas);
    const datasetName = await promptForDatasetName();
    const outputPath = await promptForOutputPath();

    // Generate Vague file
    const vagueContent = generateVagueFile(
      spec,
      selectedSchemas,
      datasetName,
      counts
    );

    // Write output
    const resolvedOutput = resolve(outputPath);
    await mkdir(dirname(resolvedOutput), { recursive: true });
    await writeFile(resolvedOutput, vagueContent, "utf-8");

    console.log(`\n✓ Generated: ${resolvedOutput}`);
    console.log(
      "\nNext steps:\n" +
        "  1. Edit the .vague file to customize field constraints\n" +
        "  2. Run vague CLI to generate JSON fixtures:\n" +
        `     npx vague ${outputPath} -o fixtures.json\n`
    );
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

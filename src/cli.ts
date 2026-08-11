#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve, relative } from "path";
import { fileURLToPath } from "url";
import { loadOpenAPISchemaNames } from "./parser.js";
import { generateVagueFile } from "./generator.js";
import { generateData } from "./vague.js";
import {
  promptForSchemas,
  promptForCounts,
  promptForOutputPath,
  promptForDatasetName,
} from "./prompts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function getVersion(): Promise<string> {
  try {
    const pkgPath = resolve(__dirname, "../package.json");
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function printHelp() {
  console.log(`
Weavr Data Generator

Generate Vague schemas and JSON fixtures from Weavr OpenAPI specifications.

Usage:
  weavr-gen [options] [spec-path]

Arguments:
  spec-path           Path to OpenAPI spec file (default: ./embedder.json)

Options:
  -h, --help          Show this help message
  -v, --version       Show version number

Examples:
  weavr-gen                       Use default embedder.json
  weavr-gen ./api-spec.json       Use custom spec file
  weavr-gen --help                Show help
`);
}

async function main() {
  const args = process.argv.slice(2);

  // Handle CLI flags
  if (args.includes("-h") || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  if (args.includes("-v") || args.includes("--version")) {
    const version = await getVersion();
    console.log(`weavr-gen v${version}`);
    process.exit(0);
  }

  // Filter out any flags to get the spec path
  const nonFlagArgs = args.filter((arg) => !arg.startsWith("-"));
  const specPath = nonFlagArgs[0] ?? "./embedder.json";

  console.log("Weavr Data Generator\n");
  console.log(`Loading OpenAPI spec from: ${specPath}\n`);

  try {
    const resolvedSpec = resolve(specPath);
    const schemaNames = await loadOpenAPISchemaNames(resolvedSpec);
    console.log(`Loaded ${schemaNames.length} OpenAPI schemas\n`);

    // Interactive prompts
    const selectedSchemas = await promptForSchemas(schemaNames);

    if (selectedSchemas.length === 0) {
      console.log("No schemas selected. Exiting.");
      process.exit(0);
    }

    console.log(`\nSelected ${selectedSchemas.length} schemas\n`);

    const counts = await promptForCounts(selectedSchemas);
    const datasetName = await promptForDatasetName(selectedSchemas);
    const outputPath = await promptForOutputPath(selectedSchemas);

    // Calculate relative path from output directory to spec file
    const resolvedOutput = resolve(outputPath);
    const relativeSpecPath = relative(dirname(resolvedOutput), resolvedSpec);

    // Describe the requested dataset; Vague imports and converts the OAS schemas.
    const vagueContent = generateVagueFile({
      specPath: relativeSpecPath,
      schemaNames: selectedSchemas,
      datasetName,
      counts,
    });

    // Write output
    await mkdir(dirname(resolvedOutput), { recursive: true });
    await writeFile(resolvedOutput, vagueContent, "utf-8");

    console.log(`\n✓ Generated: ${resolvedOutput}`);

    // Derive JSON output path from vague file path
    const jsonOutput = resolvedOutput.replace(/\.vague$/, ".json");

    console.log(`\nGenerating JSON fixtures with Vague...`);
    await generateData(resolvedOutput, jsonOutput);

    console.log(`\n✓ Fixtures written to: ${jsonOutput}`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve, relative, basename } from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { loadOpenAPISpec } from "./parser.js";
import { generateVagueFileWithOverrides } from "./generator.js";
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

function runVague(vagueFile: string, jsonOutput: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    console.log(`\nGenerating JSON fixtures...`);

    // Run from the directory containing the .vague file so imports resolve correctly
    const cwd = dirname(vagueFile);
    const vagueFileName = basename(vagueFile);
    const jsonFileName = basename(jsonOutput);

    const proc = spawn("npx", ["vague-lang", vagueFileName, "-o", jsonFileName], {
      stdio: "inherit",
      shell: true,
      cwd,
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`Vague CLI exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
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
    const datasetName = await promptForDatasetName(selectedSchemas);
    const outputPath = await promptForOutputPath(selectedSchemas);

    // Calculate relative path from output directory to spec file
    const resolvedOutput = resolve(outputPath);
    const resolvedSpec = resolve(specPath);
    const relativeSpecPath = relative(dirname(resolvedOutput), resolvedSpec);

    // Generate Vague file (imports OpenAPI spec, only adds overrides)
    const vagueContent = generateVagueFileWithOverrides(spec, {
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

    // Execute vague CLI
    await runVague(resolvedOutput, jsonOutput);

    console.log(`\n✓ Fixtures written to: ${jsonOutput}`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

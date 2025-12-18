import { checkbox, input, confirm } from "@inquirer/prompts";
import type { OpenAPISpec } from "./types.js";
import { extractSchemaNames } from "./parser.js";

// Group schemas by category based on common prefixes/patterns
function categorizeSchemas(names: string[]): Map<string, string[]> {
  const categories = new Map<string, string[]>();

  const categoryPatterns: [RegExp, string][] = [
    [/^(Corporate|Consumer)/, "Identities"],
    [/^(ManagedAccount|ManagedCard|LinkedAccount)/, "Instruments"],
    [/^(Send|Transfer|OutgoingWireTransfer)/, "Transactions"],
    [/^Beneficiary/, "Beneficiaries"],
    [/^(Card|Spend|SpendLimit)/, "Cards"],
    [/^(Currency|Amount|Balance)/, "Financial"],
    [/^(User|Identity|Auth)/, "Users & Auth"],
    [/^(Address|Mobile|Email|Date)/, "Common Types"],
  ];

  for (const name of names) {
    let matched = false;
    for (const [pattern, category] of categoryPatterns) {
      if (pattern.test(name)) {
        if (!categories.has(category)) {
          categories.set(category, []);
        }
        categories.get(category)!.push(name);
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (!categories.has("Other")) {
        categories.set("Other", []);
      }
      categories.get("Other")!.push(name);
    }
  }

  return categories;
}

export async function promptForSchemas(spec: OpenAPISpec): Promise<string[]> {
  const allSchemas = extractSchemaNames(spec);
  const categories = categorizeSchemas(allSchemas);

  // Build choices with separators for categories
  const choices: Array<{ name: string; value: string } | { type: "separator"; separator: string }> = [];

  // Prioritize important categories first
  const orderedCategories = [
    "Identities",
    "Instruments",
    "Transactions",
    "Beneficiaries",
    "Cards",
    "Users & Auth",
    "Financial",
    "Common Types",
    "Other",
  ];

  for (const category of orderedCategories) {
    const schemas = categories.get(category);
    if (schemas && schemas.length > 0) {
      choices.push({ type: "separator", separator: `── ${category} ──` });
      for (const schema of schemas.sort()) {
        choices.push({ name: schema, value: schema });
      }
    }
  }

  const selected = await checkbox({
    message: "Select schemas to generate (space to toggle, enter to confirm):",
    choices: choices as any,
    pageSize: 20,
  });

  return selected as string[];
}

export async function promptForCounts(
  schemas: string[]
): Promise<Record<string, number>> {
  const useDefaults = await confirm({
    message: "Use default count of 10 for all schemas?",
    default: true,
  });

  if (useDefaults) {
    return Object.fromEntries(schemas.map((s) => [s, 10]));
  }

  const counts: Record<string, number> = {};

  for (const schema of schemas) {
    const countStr = await input({
      message: `How many ${schema} records?`,
      default: "10",
    });
    counts[schema] = parseInt(countStr, 10) || 10;
  }

  return counts;
}

export async function promptForOutputPath(): Promise<string> {
  return input({
    message: "Output file path:",
    default: "./output/fixtures.vague",
  });
}

export async function promptForDatasetName(): Promise<string> {
  return input({
    message: "Dataset name:",
    default: "WeavrFixtures",
  });
}

import type {
  OpenAPISpec,
  OpenAPISchema,
  FieldConstraints,
} from "./types.js";

export interface GeneratorOptions {
  specPath: string;
  schemaNames: string[];
  datasetName: string;
  counts: Record<string, number>;
}

export function generateVagueFile(options: GeneratorOptions): string {
  const { specPath, schemaNames, datasetName, counts } = options;
  const lines: string[] = [];

  // Import the OpenAPI spec
  lines.push(`import weavr from "${specPath}"`);
  lines.push("");

  // Generate schema extensions for each selected schema
  for (const name of schemaNames) {
    lines.push(`schema ${name} from weavr.${name} {`);
    lines.push(`  // Add field overrides here, e.g.:`);
    lines.push(`  // email: email()`);
    lines.push(`  // id: unique digits(10)`);
    lines.push(`}`);
    lines.push("");
  }

  // Generate dataset definition
  lines.push(`dataset ${datasetName} {`);
  for (const name of schemaNames) {
    const count = counts[name] ?? 10;
    const collectionName = pluralize(camelCase(name));
    lines.push(`  ${collectionName}: ${count} of ${name}`);
  }
  lines.push("}");

  return lines.join("\n");
}

export function generateVagueFileWithOverrides(
  spec: OpenAPISpec,
  options: GeneratorOptions
): string {
  const { specPath, schemaNames, datasetName, counts } = options;
  const lines: string[] = [];

  // Import the OpenAPI spec
  lines.push(`import weavr from "${specPath}"`);
  lines.push("");

  // Generate schema extensions with smart field overrides
  for (const name of schemaNames) {
    const schema = spec.components?.schemas?.[name];
    const overrides = schema ? generateFieldOverrides(schema) : [];

    lines.push(`schema ${name} from weavr.${name} {`);
    if (overrides.length > 0) {
      for (const override of overrides) {
        lines.push(`  ${override}`);
      }
    } else {
      lines.push(`  // Add field overrides here`);
    }
    lines.push(`}`);
    lines.push("");
  }

  // Generate dataset definition
  lines.push(`dataset ${datasetName} {`);
  for (const name of schemaNames) {
    const count = counts[name] ?? 10;
    const collectionName = pluralize(camelCase(name));
    lines.push(`  ${collectionName}: ${count} of ${name}`);
  }
  lines.push("}");

  return lines.join("\n");
}

function generateFieldOverrides(schema: OpenAPISchema): string[] {
  const overrides: string[] = [];
  const properties = schema.properties ?? {};

  for (const [name, prop] of Object.entries(properties)) {
    const override = generateFieldOverride(name, prop);
    if (override) {
      overrides.push(override);
    }
  }

  return overrides;
}

function generateFieldOverride(
  name: string,
  schema: OpenAPISchema
): string | null {
  const constraints: FieldConstraints = {
    pattern: schema.pattern,
    format: schema.format,
    minLength: schema.minLength,
    maxLength: schema.maxLength,
    minimum: schema.minimum,
    maximum: schema.maximum,
  };

  // Only generate overrides for fields that benefit from custom generators
  if (constraints.format === "email") {
    return `${name}: email()`;
  }

  if (constraints.format === "uuid") {
    return `${name}: uuid()`;
  }

  if (constraints.pattern === "^[0-9]+$") {
    return `${name}: digits(12)`;
  }

  if (constraints.pattern === "^[0-9]{6}$") {
    return `${name}: digits(6)`;
  }

  if (constraints.pattern === "^\\+[0-9]+$") {
    return `${name}: regex("\\\\+[0-9]{1,3}")`;
  }

  if (constraints.pattern === "^[a-z]{2}(-[A-Z]{2})?$") {
    return `${name}: "en" | "en-GB" | "en-US" | "de" | "fr"`;
  }

  // Don't override fields that OpenAPI handles well
  return null;
}

function camelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function pluralize(str: string): string {
  if (str.endsWith("s")) return str;
  if (str.endsWith("y")) return str.slice(0, -1) + "ies";
  return str + "s";
}

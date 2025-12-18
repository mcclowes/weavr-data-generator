import type {
  ParsedSchema,
  ParsedField,
  FieldType,
  FieldConstraints,
  OpenAPISpec,
} from "./types.js";
import { parseSchema } from "./parser.js";

export function generateVagueFile(
  spec: OpenAPISpec,
  schemaNames: string[],
  datasetName = "WeavrFixtures",
  counts: Record<string, number> = {}
): string {
  const parsedSchemas = new Map<string, ParsedSchema>();
  const processQueue = [...schemaNames];
  const processed = new Set<string>();

  // Parse all schemas and their dependencies
  while (processQueue.length > 0) {
    const name = processQueue.shift()!;
    if (processed.has(name)) continue;

    try {
      const schema = parseSchema(spec, name, new Set());
      parsedSchemas.set(name, schema);
      processed.add(name);

      for (const dep of schema.dependencies) {
        if (!processed.has(dep)) {
          processQueue.push(dep);
        }
      }
    } catch {
      // Skip schemas that can't be parsed
      processed.add(name);
    }
  }

  const lines: string[] = [];

  // Generate schema definitions in dependency order
  const ordered = topologicalSort(parsedSchemas);
  for (const name of ordered) {
    const schema = parsedSchemas.get(name);
    if (schema) {
      lines.push(generateSchemaDefinition(schema));
      lines.push("");
    }
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

function generateSchemaDefinition(schema: ParsedSchema): string {
  const lines: string[] = [];

  if (schema.description) {
    lines.push(`// ${schema.description}`);
  }

  lines.push(`schema ${schema.name} {`);

  for (const field of schema.fields) {
    const fieldDef = generateFieldDefinition(field);
    if (field.description) {
      lines.push(`  // ${field.description}`);
    }
    lines.push(`  ${field.name}: ${fieldDef}${field.required ? "" : "?"}`);
  }

  lines.push("}");
  return lines.join("\n");
}

function generateFieldDefinition(field: ParsedField): string {
  return generateTypeDefinition(field.type, field.constraints);
}

function generateTypeDefinition(
  type: FieldType,
  constraints: FieldConstraints
): string {
  switch (type.kind) {
    case "primitive":
      return generatePrimitiveType(type.type, constraints);

    case "enum":
      return type.values.map((v) => `"${v}"`).join(" | ");

    case "ref":
      return type.schemaName;

    case "array":
      const itemType = generateTypeDefinition(type.itemType, {});
      return `1..5 of ${itemType}`;

    case "object":
      if (type.fields.length === 0) return "{}";
      const nested = type.fields
        .map((f) => `    ${f.name}: ${generateFieldDefinition(f)}`)
        .join(",\n");
      return `{\n${nested}\n  }`;

    case "oneOf":
      // For oneOf, generate the first option as the default
      if (type.options.length > 0) {
        return generateTypeDefinition(type.options[0], constraints);
      }
      return "string";
  }
}

function generatePrimitiveType(
  type: "string" | "int" | "decimal" | "boolean",
  constraints: FieldConstraints
): string {
  // Handle special formats first
  if (constraints.format) {
    switch (constraints.format) {
      case "email":
        return "email()";
      case "uuid":
        return "uuid()";
      case "date":
        return "date in 2020..2024";
      case "date-time":
        return "int in 1577836800000..1735689600000"; // 2020-2025 timestamps
      case "uri":
      case "url":
        return "faker.internet.url()";
      case "int32":
      case "int64":
        return generateIntWithConstraints(constraints);
    }
  }

  // Handle patterns for specific Weavr types
  if (constraints.pattern) {
    return generateFromPattern(constraints.pattern, constraints);
  }

  switch (type) {
    case "string":
      return generateStringWithConstraints(constraints);
    case "int":
      return generateIntWithConstraints(constraints);
    case "decimal":
      return generateDecimalWithConstraints(constraints);
    case "boolean":
      return "boolean";
  }
}

function generateStringWithConstraints(constraints: FieldConstraints): string {
  const { minLength, maxLength } = constraints;

  if (minLength !== undefined && maxLength !== undefined) {
    if (maxLength <= 50) {
      return `alphanumeric(${maxLength})`;
    }
    return "sentence()";
  }

  if (maxLength !== undefined && maxLength <= 50) {
    return `alphanumeric(${maxLength})`;
  }

  return "string";
}

function generateIntWithConstraints(constraints: FieldConstraints): string {
  const { minimum, maximum } = constraints;

  if (minimum !== undefined && maximum !== undefined) {
    return `int in ${minimum}..${maximum}`;
  }

  if (minimum !== undefined) {
    return `int in ${minimum}..${minimum + 1000}`;
  }

  if (maximum !== undefined) {
    return `int in 0..${maximum}`;
  }

  return "int in 1..10000";
}

function generateDecimalWithConstraints(constraints: FieldConstraints): string {
  const { minimum, maximum } = constraints;

  if (minimum !== undefined && maximum !== undefined) {
    return `decimal in ${minimum}..${maximum}`;
  }

  return "decimal in 0.00..10000.00";
}

function generateFromPattern(
  pattern: string,
  constraints: FieldConstraints
): string {
  // Common Weavr patterns
  if (pattern === "^[0-9]+$") {
    return "digits(10)";
  }

  if (pattern === "^[a-zA-Z0-9_-]+$") {
    const len = constraints.maxLength ?? 20;
    return `alphanumeric(${len})`;
  }

  if (pattern === "^\\+[0-9]+$") {
    return `regex("\\+[0-9]{1,3}")`;
  }

  if (pattern === "^[0-9]{1,12}$") {
    return "digits(10)";
  }

  if (pattern === "^[0-9]{6}$") {
    return "digits(6)";
  }

  if (pattern === "^[A-Z]+$") {
    const len = constraints.maxLength ?? 2;
    return `regex("[A-Z]{${len}}")`;
  }

  if (pattern === "^[a-z]{2}(-[A-Z]{2})?$") {
    return `"en" | "en-GB" | "en-US" | "de" | "fr"`;
  }

  // Fallback: use regex generator with the pattern
  return `regex("${escapeRegexForVague(pattern)}")`;
}

function escapeRegexForVague(pattern: string): string {
  // Remove anchors and escape quotes
  return pattern.replace(/^\^/, "").replace(/\$$/, "").replace(/"/g, '\\"');
}

function topologicalSort(schemas: Map<string, ParsedSchema>): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    if (visiting.has(name)) return; // Skip circular dependencies

    visiting.add(name);

    const schema = schemas.get(name);
    if (schema) {
      for (const dep of schema.dependencies) {
        if (schemas.has(dep)) {
          visit(dep);
        }
      }
    }

    visiting.delete(name);
    visited.add(name);
    result.push(name);
  }

  for (const name of schemas.keys()) {
    visit(name);
  }

  return result;
}

function camelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function pluralize(str: string): string {
  if (str.endsWith("s")) return str;
  if (str.endsWith("y")) return str.slice(0, -1) + "ies";
  return str + "s";
}

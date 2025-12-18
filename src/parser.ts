import { readFile } from "fs/promises";
import type {
  OpenAPISpec,
  OpenAPISchema,
  ParsedSchema,
  ParsedField,
  FieldType,
  FieldConstraints,
} from "./types.js";

export async function loadOpenAPISpec(path: string): Promise<OpenAPISpec> {
  const content = await readFile(path, "utf-8");
  return JSON.parse(content) as OpenAPISpec;
}

export function extractSchemaNames(spec: OpenAPISpec): string[] {
  const schemas = spec.components?.schemas ?? {};
  return Object.keys(schemas).sort();
}

export function parseSchema(
  spec: OpenAPISpec,
  schemaName: string,
  visited = new Set<string>()
): ParsedSchema {
  const schemas = spec.components?.schemas ?? {};
  const schema = schemas[schemaName];

  if (!schema) {
    throw new Error(`Schema "${schemaName}" not found`);
  }

  visited.add(schemaName);
  const dependencies: string[] = [];

  const fields = parseSchemaFields(spec, schema, dependencies, visited);

  return {
    name: schemaName,
    description: schema.description,
    fields,
    dependencies: [...new Set(dependencies)],
  };
}

function parseSchemaFields(
  spec: OpenAPISpec,
  schema: OpenAPISchema,
  dependencies: string[],
  visited: Set<string>
): ParsedField[] {
  const resolvedSchema = resolveAllOf(spec, schema);
  const properties = resolvedSchema.properties ?? {};
  const required = new Set(resolvedSchema.required ?? []);

  return Object.entries(properties).map(([name, propSchema]) => ({
    name,
    type: parseFieldType(spec, propSchema, dependencies, visited),
    required: required.has(name),
    description: propSchema.description,
    constraints: extractConstraints(propSchema),
  }));
}

function resolveAllOf(spec: OpenAPISpec, schema: OpenAPISchema): OpenAPISchema {
  if (!schema.allOf) return schema;

  let merged: OpenAPISchema = { type: "object", properties: {}, required: [] };

  for (const part of schema.allOf) {
    const resolved = part.$ref ? resolveRef(spec, part.$ref) : part;
    merged.properties = { ...merged.properties, ...resolved.properties };
    merged.required = [...(merged.required ?? []), ...(resolved.required ?? [])];
    if (resolved.description) merged.description = resolved.description;
  }

  return merged;
}

function resolveRef(spec: OpenAPISpec, ref: string): OpenAPISchema {
  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  if (!match) return {};

  const schemaName = match[1];
  return spec.components?.schemas?.[schemaName] ?? {};
}

function parseFieldType(
  spec: OpenAPISpec,
  schema: OpenAPISchema,
  dependencies: string[],
  visited: Set<string>
): FieldType {
  if (schema.$ref) {
    const match = schema.$ref.match(/^#\/components\/schemas\/(.+)$/);
    if (match) {
      const refName = match[1];
      if (!visited.has(refName)) {
        dependencies.push(refName);
      }
      return { kind: "ref", schemaName: refName };
    }
  }

  if (schema.oneOf) {
    return {
      kind: "oneOf",
      options: schema.oneOf.map((opt) =>
        parseFieldType(spec, opt, dependencies, visited)
      ),
    };
  }

  if (schema.enum) {
    return { kind: "enum", values: schema.enum };
  }

  if (schema.type === "array" && schema.items) {
    return {
      kind: "array",
      itemType: parseFieldType(spec, schema.items, dependencies, visited),
    };
  }

  if (schema.type === "object" && schema.properties) {
    return {
      kind: "object",
      fields: parseSchemaFields(spec, schema, dependencies, visited),
    };
  }

  return { kind: "primitive", type: mapPrimitiveType(schema) };
}

function mapPrimitiveType(
  schema: OpenAPISchema
): "string" | "int" | "decimal" | "boolean" {
  switch (schema.type) {
    case "integer":
      return "int";
    case "number":
      return "decimal";
    case "boolean":
      return "boolean";
    default:
      return "string";
  }
}

function extractConstraints(schema: OpenAPISchema): FieldConstraints {
  return {
    pattern: schema.pattern,
    format: schema.format,
    minLength: schema.minLength,
    maxLength: schema.maxLength,
    minimum: schema.minimum,
    maximum: schema.maximum,
  };
}

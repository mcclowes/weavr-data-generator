export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  components?: {
    schemas?: Record<string, OpenAPISchema>;
  };
}

export interface OpenAPISchema {
  type?: string;
  format?: string;
  description?: string;
  enum?: string[];
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  required?: string[];
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  $ref?: string;
  oneOf?: OpenAPISchema[];
  allOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
}

export interface ParsedSchema {
  name: string;
  description?: string;
  fields: ParsedField[];
  dependencies: string[];
}

export interface ParsedField {
  name: string;
  type: FieldType;
  required: boolean;
  description?: string;
  constraints: FieldConstraints;
}

export type FieldType =
  | { kind: "primitive"; type: "string" | "int" | "decimal" | "boolean" }
  | { kind: "enum"; values: string[] }
  | { kind: "ref"; schemaName: string }
  | { kind: "array"; itemType: FieldType }
  | { kind: "object"; fields: ParsedField[] }
  | { kind: "oneOf"; options: FieldType[] };

export interface FieldConstraints {
  pattern?: string;
  format?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

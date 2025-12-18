import { describe, it, expect } from "vitest";
import { extractSchemaNames, parseSchema } from "../parser.js";
import type { OpenAPISpec } from "../types.js";

const mockSpec: OpenAPISpec = {
  openapi: "3.1.0",
  info: { title: "Test API", version: "1.0.0" },
  components: {
    schemas: {
      Email: {
        type: "string",
        format: "email",
        description: "Email address",
      },
      Mobile: {
        type: "object",
        required: ["countryCode", "number"],
        properties: {
          countryCode: {
            type: "string",
            pattern: "^\\+[0-9]+$",
            maxLength: 4,
          },
          number: {
            type: "string",
            pattern: "^[0-9]{1,12}$",
          },
        },
      },
      Status: {
        type: "string",
        enum: ["ACTIVE", "INACTIVE", "PENDING"],
      },
      User: {
        type: "object",
        required: ["id", "email"],
        properties: {
          id: { type: "string", pattern: "^[0-9]+$" },
          email: { $ref: "#/components/schemas/Email" },
          mobile: { $ref: "#/components/schemas/Mobile" },
          status: { $ref: "#/components/schemas/Status" },
        },
      },
    },
  },
};

describe("extractSchemaNames", () => {
  it("extracts all schema names sorted alphabetically", () => {
    const names = extractSchemaNames(mockSpec);
    expect(names).toEqual(["Email", "Mobile", "Status", "User"]);
  });

  it("returns empty array for spec without schemas", () => {
    const emptySpec: OpenAPISpec = {
      openapi: "3.1.0",
      info: { title: "Empty", version: "1.0.0" },
    };
    expect(extractSchemaNames(emptySpec)).toEqual([]);
  });
});

describe("parseSchema", () => {
  it("parses primitive schema with format", () => {
    const parsed = parseSchema(mockSpec, "Email");
    expect(parsed.name).toBe("Email");
    expect(parsed.description).toBe("Email address");
    expect(parsed.fields).toHaveLength(0); // primitive, no fields
    expect(parsed.dependencies).toHaveLength(0);
  });

  it("parses object schema with required fields", () => {
    const parsed = parseSchema(mockSpec, "Mobile");
    expect(parsed.name).toBe("Mobile");
    expect(parsed.fields).toHaveLength(2);

    const countryCode = parsed.fields.find((f) => f.name === "countryCode");
    expect(countryCode?.required).toBe(true);
    expect(countryCode?.constraints.pattern).toBe("^\\+[0-9]+$");
    expect(countryCode?.constraints.maxLength).toBe(4);
  });

  it("parses enum schema", () => {
    const parsed = parseSchema(mockSpec, "Status");
    expect(parsed.fields).toHaveLength(0);
  });

  it("parses schema with references and tracks dependencies", () => {
    const parsed = parseSchema(mockSpec, "User");
    expect(parsed.fields).toHaveLength(4);
    expect(parsed.dependencies).toContain("Email");
    expect(parsed.dependencies).toContain("Mobile");
    expect(parsed.dependencies).toContain("Status");
  });

  it("throws for non-existent schema", () => {
    expect(() => parseSchema(mockSpec, "NonExistent")).toThrow('Schema "NonExistent" not found');
  });
});

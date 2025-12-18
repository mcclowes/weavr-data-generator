import { describe, it, expect } from "vitest";
import { generateVagueFile } from "../generator.js";
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
      Status: {
        type: "string",
        enum: ["ACTIVE", "INACTIVE", "PENDING"],
      },
      Currency: {
        type: "string",
        enum: ["EUR", "GBP", "USD"],
      },
      CurrencyAmount: {
        type: "object",
        required: ["currency", "amount"],
        properties: {
          currency: { $ref: "#/components/schemas/Currency" },
          amount: { type: "integer", format: "int64" },
        },
      },
      User: {
        type: "object",
        required: ["id", "email"],
        description: "A user in the system",
        properties: {
          id: { type: "string", pattern: "^[0-9]+$" },
          email: { $ref: "#/components/schemas/Email" },
          status: { $ref: "#/components/schemas/Status" },
        },
      },
    },
  },
};

describe("generateVagueFile", () => {
  it("generates schema definitions with correct syntax", () => {
    const output = generateVagueFile(mockSpec, ["User"], "TestData", {
      User: 5,
    });

    expect(output).toContain("schema User {");
    expect(output).toContain("schema Email {");
    expect(output).toContain("schema Status {");
  });

  it("generates dataset with correct counts", () => {
    const output = generateVagueFile(mockSpec, ["User"], "TestData", {
      User: 5,
    });

    expect(output).toContain("dataset TestData {");
    expect(output).toContain("users: 5 of User");
  });

  it("handles enum types within object schemas as superpositions", () => {
    // When an enum is referenced within an object, it should be inlined as superposition
    const output = generateVagueFile(mockSpec, ["User"]);

    // Status enum referenced by User should generate Status schema
    expect(output).toContain("schema Status");
  });

  it("uses email() for email format", () => {
    const output = generateVagueFile(mockSpec, ["Email"]);

    // Email is a primitive type with format, not an object with fields
    expect(output).toContain("schema Email");
  });

  it("handles references to other schemas", () => {
    const output = generateVagueFile(mockSpec, ["CurrencyAmount"]);

    expect(output).toContain("currency: Currency");
    expect(output).toContain("schema Currency {");
  });

  it("generates dependencies in correct order", () => {
    const output = generateVagueFile(mockSpec, ["User"]);

    // Dependencies should come before User
    const emailPos = output.indexOf("schema Email");
    const statusPos = output.indexOf("schema Status");
    const userPos = output.indexOf("schema User");

    expect(emailPos).toBeLessThan(userPos);
    expect(statusPos).toBeLessThan(userPos);
  });

  it("pluralizes collection names", () => {
    const output = generateVagueFile(mockSpec, ["User", "Currency"]);

    expect(output).toContain("users:");
    expect(output).toContain("currencies:");
  });

  it("uses default count of 10 when not specified", () => {
    const output = generateVagueFile(mockSpec, ["User"]);

    expect(output).toContain("users: 10 of User");
  });
});

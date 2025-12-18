import { describe, it, expect } from "vitest";
import { generateVagueFile, generateVagueFileWithOverrides } from "../generator.js";
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
      User: {
        type: "object",
        required: ["id", "email"],
        description: "A user in the system",
        properties: {
          id: { type: "string", pattern: "^[0-9]+$" },
          email: { type: "string", format: "email" },
          locale: { type: "string", pattern: "^[a-z]{2}(-[A-Z]{2})?$" },
        },
      },
    },
  },
};

describe("generateVagueFile", () => {
  it("generates import statement for OpenAPI spec", () => {
    const output = generateVagueFile({
      specPath: "./api.json",
      schemaNames: ["User"],
      datasetName: "TestData",
      counts: { User: 5 },
    });

    expect(output).toContain('import weavr from "./api.json"');
  });

  it("generates schema extension from OpenAPI", () => {
    const output = generateVagueFile({
      specPath: "./api.json",
      schemaNames: ["User"],
      datasetName: "TestData",
      counts: { User: 5 },
    });

    expect(output).toContain("schema User from weavr.User {");
  });

  it("generates dataset with correct counts", () => {
    const output = generateVagueFile({
      specPath: "./api.json",
      schemaNames: ["User"],
      datasetName: "TestData",
      counts: { User: 5 },
    });

    expect(output).toContain("dataset TestData {");
    expect(output).toContain("users: 5 of User");
  });

  it("pluralizes collection names", () => {
    const output = generateVagueFile({
      specPath: "./api.json",
      schemaNames: ["User", "Email"],
      datasetName: "TestData",
      counts: { User: 10, Email: 10 },
    });

    expect(output).toContain("users:");
    expect(output).toContain("emails:");
  });
});

describe("generateVagueFileWithOverrides", () => {
  it("generates email() override for email format", () => {
    const output = generateVagueFileWithOverrides(mockSpec, {
      specPath: "./api.json",
      schemaNames: ["User"],
      datasetName: "TestData",
      counts: { User: 5 },
    });

    expect(output).toContain("email: email()");
  });

  it("generates digits() override for numeric patterns", () => {
    const output = generateVagueFileWithOverrides(mockSpec, {
      specPath: "./api.json",
      schemaNames: ["User"],
      datasetName: "TestData",
      counts: { User: 5 },
    });

    expect(output).toContain("id: digits(12)");
  });

  it("generates locale superposition for locale patterns", () => {
    const output = generateVagueFileWithOverrides(mockSpec, {
      specPath: "./api.json",
      schemaNames: ["User"],
      datasetName: "TestData",
      counts: { User: 5 },
    });

    expect(output).toContain('locale: "en" | "en-GB"');
  });

  it("uses default count of 10 when not specified", () => {
    const output = generateVagueFile({
      specPath: "./api.json",
      schemaNames: ["User"],
      datasetName: "TestData",
      counts: {},
    });

    expect(output).toContain("users: 10 of User");
  });
});

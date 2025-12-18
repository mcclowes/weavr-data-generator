import type { OpenAPISpec, OpenAPISchema, FieldConstraints } from "./types.js";

export interface GeneratorOptions {
  specPath: string;
  schemaNames: string[];
  datasetName: string;
  counts: Record<string, number>;
}

export function generateVagueFile(options: GeneratorOptions): string {
  const { specPath, schemaNames, datasetName, counts } = options;
  const lines: string[] = [];

  lines.push(`import weavr from "${specPath}"`);
  lines.push("");

  for (const name of schemaNames) {
    lines.push(`schema ${name} from weavr.${name} {`);
    lines.push(`  // Add field overrides here, e.g.:`);
    lines.push(`  // email: email()`);
    lines.push(`  // id: unique digits(10)`);
    lines.push(`}`);
    lines.push("");
  }

  lines.push(`dataset ${datasetName} {`);
  for (const name of schemaNames) {
    const count = counts[name] ?? 10;
    const collectionName = pluralize(camelCase(name));
    lines.push(`  ${collectionName}: ${count} of ${name}`);
  }
  lines.push("}");

  return lines.join("\n");
}

interface LetBinding {
  name: string;
  value: string;
}

interface OverrideResult {
  overrides: string[];
  letBindings: LetBinding[];
}

export function generateVagueFileWithOverrides(
  spec: OpenAPISpec,
  options: GeneratorOptions
): string {
  const { specPath, schemaNames, datasetName, counts } = options;
  const lines: string[] = [];
  const allLetBindings: LetBinding[] = [];

  lines.push(`import weavr from "${specPath}"`);

  // Collect all overrides and let bindings first
  const schemaOverrides: Map<string, string[]> = new Map();
  for (const name of schemaNames) {
    const schema = spec.components?.schemas?.[name];
    const result = schema
      ? generateFieldOverrides(spec, schema)
      : { overrides: [], letBindings: [] };
    schemaOverrides.set(name, result.overrides);
    allLetBindings.push(...result.letBindings);
  }

  // Output let bindings (deduplicated)
  const seenBindings = new Set<string>();
  const uniqueBindings = allLetBindings.filter((b) => {
    if (seenBindings.has(b.name)) return false;
    seenBindings.add(b.name);
    return true;
  });

  if (uniqueBindings.length > 0) {
    lines.push("");
    for (const binding of uniqueBindings) {
      lines.push(`let ${binding.name} = ${binding.value}`);
    }
  }

  lines.push("");

  // Output schemas
  for (const name of schemaNames) {
    const overrides = schemaOverrides.get(name) ?? [];

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

  lines.push(`dataset ${datasetName} {`);
  for (const name of schemaNames) {
    const count = counts[name] ?? 10;
    const collectionName = pluralize(camelCase(name));
    lines.push(`  ${collectionName}: ${count} of ${name}`);
  }
  lines.push("}");

  return lines.join("\n");
}

const LONG_ENUM_THRESHOLD = 5; // Extract to let binding if more than this many values

function generateFieldOverrides(spec: OpenAPISpec, schema: OpenAPISchema): OverrideResult {
  const overrides: string[] = [];
  const letBindings: LetBinding[] = [];
  const properties = schema.properties ?? {};

  for (const [name, prop] of Object.entries(properties)) {
    const resolved = resolveSchema(spec, prop);
    const result = generateFieldOverride(name, resolved, spec);
    if (result) {
      overrides.push(result.override);
      if (result.letBinding) {
        letBindings.push(result.letBinding);
      }
    }
  }

  return { overrides, letBindings };
}

function resolveSchema(spec: OpenAPISpec, schema: OpenAPISchema): OpenAPISchema {
  if (schema.$ref) {
    const match = schema.$ref.match(/^#\/components\/schemas\/(.+)$/);
    if (match) {
      const refSchema = spec.components?.schemas?.[match[1]];
      if (refSchema) {
        return { ...refSchema, description: schema.description ?? refSchema.description };
      }
    }
  }
  return schema;
}

interface FieldOverrideResult {
  override: string;
  letBinding?: LetBinding;
}

function generateFieldOverride(
  name: string,
  schema: OpenAPISchema,
  _spec: OpenAPISpec
): FieldOverrideResult | null {
  // Handle enums first - convert to Vague superposition
  if (schema.enum && schema.enum.length > 0) {
    const values = schema.enum.map((v) => `"${v}"`).join(" | ");

    // Extract long enums to let bindings for readability
    if (schema.enum.length > LONG_ENUM_THRESHOLD) {
      const bindingName = `${name}Values`;
      return {
        override: `${name}: ${bindingName}`,
        letBinding: { name: bindingName, value: values },
      };
    }
    return { override: `${name}: ${values}` };
  }

  const constraints: FieldConstraints = {
    pattern: schema.pattern,
    format: schema.format,
    minLength: schema.minLength,
    maxLength: schema.maxLength,
    minimum: schema.minimum,
    maximum: schema.maximum,
  };

  // Helper to wrap simple overrides
  const simple = (value: string): FieldOverrideResult => ({
    override: `${name}: ${value}`,
  });

  // Format-based generators
  if (constraints.format === "email") return simple("email()");
  if (constraints.format === "uuid") return simple("uuid()");
  if (constraints.format === "uri" || constraints.format === "url")
    return simple("faker.internet.url()");
  if (constraints.format === "date") return simple('dateBetween("2020-01-01", "2025-12-31")');
  if (constraints.format === "date-time") return simple("datetime(2020, 2025)");
  if (constraints.format === "int64" && isTimestampField(name)) {
    return simple("int in 1609459200000..1735689600000"); // 2021-2025 epoch ms
  }

  // Pattern-based generators
  if (constraints.pattern === "^[0-9]+$") return simple("unique digits(12)");
  if (constraints.pattern === "^[0-9]{6}$") return simple("digits(6)");
  if (constraints.pattern === "^\\+[0-9]+$") return simple('regex("\\\\+[1-9][0-9]{8,14}")');
  if (constraints.pattern === "^[a-z]{2}(-[A-Z]{2})?$") {
    return simple('"en" | "en-GB" | "en-US" | "de-DE" | "fr-FR" | "es-ES"');
  }
  if (constraints.pattern === "^[A-Z]{3}$") {
    return simple('"EUR" | "GBP" | "USD"');
  }

  // Field name heuristics
  const nameLower = name.toLowerCase();

  // ID fields
  if (nameLower === "id" || nameLower.endsWith("id")) {
    if (schema.type === "string") return simple("unique digits(18)");
  }

  // Network/Contact fields
  if (nameLower === "ipaddress" || nameLower === "ip" || nameLower.includes("ip_address")) {
    return simple("faker.internet.ip()");
  }
  if (nameLower === "email" || nameLower.endsWith("email")) return simple("email()");
  if (nameLower === "phone" || nameLower.includes("mobile") || nameLower.includes("telephone")) {
    return simple("phone()");
  }
  if (nameLower === "url" || nameLower.includes("website") || nameLower.includes("link")) {
    return simple("faker.internet.url()");
  }

  // Name fields
  if (nameLower === "firstname" || nameLower === "first_name") return simple("firstName()");
  if (nameLower === "lastname" || nameLower === "last_name" || nameLower === "surname")
    return simple("lastName()");
  if (nameLower === "name" || nameLower === "fullname" || nameLower === "full_name")
    return simple("fullName()");
  if (nameLower === "companyname" || nameLower === "company" || nameLower === "businessname") {
    return simple("companyName()");
  }

  // Address fields
  if (
    nameLower === "address" ||
    nameLower === "streetaddress" ||
    nameLower.includes("address_line")
  ) {
    return simple("streetAddress()");
  }
  if (nameLower === "city") return simple("city()");
  if (nameLower === "state" || nameLower === "province" || nameLower === "region")
    return simple("state()");
  if (nameLower === "country") return simple('"GB" | "US" | "DE" | "FR" | "ES" | "IT" | "NL"');
  if (
    nameLower === "postcode" ||
    nameLower === "postalcode" ||
    nameLower === "zipcode" ||
    nameLower === "zip"
  ) {
    return simple("zipCode()");
  }

  // Date/Time fields
  if (isTimestampField(name)) {
    if (schema.type === "integer") return simple("int in 1609459200000..1735689600000");
    return simple("datetime(2020, 2025)");
  }
  if (nameLower.includes("date") && !nameLower.includes("timestamp")) {
    return simple('dateBetween("2020-01-01", "2025-12-31")');
  }

  // Currency/Money fields
  if (nameLower === "currency" || nameLower === "currencycode" || nameLower === "basecurrency") {
    return simple('"EUR" | "GBP" | "USD"');
  }
  if (nameLower === "amount" || nameLower.includes("amount") || nameLower === "balance") {
    return simple("int in 1000..100000");
  }
  if (nameLower === "iban" || nameLower.includes("iban")) {
    return simple("faker.finance.iban()");
  }
  if (nameLower === "bic" || nameLower === "swift" || nameLower.includes("swiftcode")) {
    return simple("faker.finance.bic()");
  }
  if (nameLower.includes("accountnumber") || nameLower === "accountno") {
    return simple("faker.finance.accountNumber()");
  }

  // Document fields
  if (nameLower === "description" || nameLower === "notes" || nameLower === "comment") {
    return simple("sentence()");
  }

  // Status/Type fields (often have no enum but should)
  if (nameLower === "status" && schema.type === "string") {
    return simple('"ACTIVE" | "INACTIVE" | "PENDING"');
  }
  if (nameLower === "type" && schema.type === "string" && !schema.enum) {
    return simple('"DEFAULT"');
  }

  // Tag fields
  if (nameLower === "tag" && schema.type === "string") {
    return simple("alphanumeric(8)");
  }

  // Fee/Group fields
  if (nameLower.includes("fee") || nameLower.includes("group")) {
    return simple('"DEFAULT" | "STANDARD" | "PREMIUM"');
  }

  // Source fields
  if (nameLower.includes("sourceof") || nameLower.includes("source_of")) {
    return simple('"SALARY" | "SAVINGS" | "BUSINESS" | "INVESTMENT"');
  }

  // Boolean fields don't need override - OpenAPI handles them
  if (schema.type === "boolean") return null;

  // Integer with bounds
  if (
    schema.type === "integer" &&
    (constraints.minimum !== undefined || constraints.maximum !== undefined)
  ) {
    const min = constraints.minimum ?? 0;
    const max = constraints.maximum ?? 1000000;
    return simple(`int in ${min}..${max}`);
  }

  return null;
}

function isTimestampField(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes("timestamp") || lower.endsWith("_at") || lower.endsWith("at");
}

function camelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function pluralize(str: string): string {
  if (str.endsWith("s")) return str;
  if (str.endsWith("y")) return str.slice(0, -1) + "ies";
  return str + "s";
}

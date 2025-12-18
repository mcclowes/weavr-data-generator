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

export function generateVagueFileWithOverrides(
  spec: OpenAPISpec,
  options: GeneratorOptions
): string {
  const { specPath, schemaNames, datasetName, counts } = options;
  const lines: string[] = [];

  lines.push(`import weavr from "${specPath}"`);
  lines.push("");

  for (const name of schemaNames) {
    const schema = spec.components?.schemas?.[name];
    const overrides = schema
      ? generateFieldOverrides(spec, schema)
      : [];

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

function generateFieldOverrides(
  spec: OpenAPISpec,
  schema: OpenAPISchema
): string[] {
  const overrides: string[] = [];
  const properties = schema.properties ?? {};

  for (const [name, prop] of Object.entries(properties)) {
    const resolved = resolveSchema(spec, prop);
    const override = generateFieldOverride(name, resolved, spec);
    if (override) {
      overrides.push(override);
    }
  }

  return overrides;
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

function generateFieldOverride(
  name: string,
  schema: OpenAPISchema,
  _spec: OpenAPISpec
): string | null {
  // Handle enums first - convert to Vague superposition
  if (schema.enum && schema.enum.length > 0) {
    const values = schema.enum.map((v) => `"${v}"`).join(" | ");
    return `${name}: ${values}`;
  }

  const constraints: FieldConstraints = {
    pattern: schema.pattern,
    format: schema.format,
    minLength: schema.minLength,
    maxLength: schema.maxLength,
    minimum: schema.minimum,
    maximum: schema.maximum,
  };

  // Format-based generators
  if (constraints.format === "email") return `${name}: email()`;
  if (constraints.format === "uuid") return `${name}: uuid()`;
  if (constraints.format === "uri" || constraints.format === "url") return `${name}: faker.internet.url()`;
  if (constraints.format === "date") return `${name}: dateBetween("2020-01-01", "2025-12-31")`;
  if (constraints.format === "date-time") return `${name}: datetime(2020, 2025)`;
  if (constraints.format === "int64" && isTimestampField(name)) {
    return `${name}: int in 1609459200000..1735689600000`; // 2021-2025 epoch ms
  }

  // Pattern-based generators
  if (constraints.pattern === "^[0-9]+$") return `${name}: unique digits(12)`;
  if (constraints.pattern === "^[0-9]{6}$") return `${name}: digits(6)`;
  if (constraints.pattern === "^\\+[0-9]+$") return `${name}: regex("\\\\+[1-9][0-9]{8,14}")`;
  if (constraints.pattern === "^[a-z]{2}(-[A-Z]{2})?$") {
    return `${name}: "en" | "en-GB" | "en-US" | "de-DE" | "fr-FR" | "es-ES"`;
  }
  if (constraints.pattern === "^[A-Z]{3}$") {
    return `${name}: "EUR" | "GBP" | "USD"`;
  }

  // Field name heuristics
  const nameLower = name.toLowerCase();

  // ID fields
  if (nameLower === "id" || nameLower.endsWith("id")) {
    if (schema.type === "string") return `${name}: unique digits(18)`;
  }

  // Network/Contact fields
  if (nameLower === "ipaddress" || nameLower === "ip" || nameLower.includes("ip_address")) {
    return `${name}: faker.internet.ip()`;
  }
  if (nameLower === "email" || nameLower.endsWith("email")) return `${name}: email()`;
  if (nameLower === "phone" || nameLower.includes("mobile") || nameLower.includes("telephone")) {
    return `${name}: phone()`;
  }
  if (nameLower === "url" || nameLower.includes("website") || nameLower.includes("link")) {
    return `${name}: faker.internet.url()`;
  }

  // Name fields
  if (nameLower === "firstname" || nameLower === "first_name") return `${name}: firstName()`;
  if (nameLower === "lastname" || nameLower === "last_name" || nameLower === "surname") return `${name}: lastName()`;
  if (nameLower === "name" || nameLower === "fullname" || nameLower === "full_name") return `${name}: fullName()`;
  if (nameLower === "companyname" || nameLower === "company" || nameLower === "businessname") {
    return `${name}: companyName()`;
  }

  // Address fields
  if (nameLower === "address" || nameLower === "streetaddress" || nameLower.includes("address_line")) {
    return `${name}: streetAddress()`;
  }
  if (nameLower === "city") return `${name}: city()`;
  if (nameLower === "state" || nameLower === "province" || nameLower === "region") return `${name}: state()`;
  if (nameLower === "country") return `${name}: "GB" | "US" | "DE" | "FR" | "ES" | "IT" | "NL"`;
  if (nameLower === "postcode" || nameLower === "postalcode" || nameLower === "zipcode" || nameLower === "zip") {
    return `${name}: zipCode()`;
  }

  // Date/Time fields
  if (isTimestampField(name)) {
    if (schema.type === "integer") return `${name}: int in 1609459200000..1735689600000`;
    return `${name}: datetime(2020, 2025)`;
  }
  if (nameLower.includes("date") && !nameLower.includes("timestamp")) {
    return `${name}: dateBetween("2020-01-01", "2025-12-31")`;
  }

  // Currency/Money fields
  if (nameLower === "currency" || nameLower === "currencycode" || nameLower === "basecurrency") {
    return `${name}: "EUR" | "GBP" | "USD"`;
  }
  if (nameLower === "amount" || nameLower.includes("amount") || nameLower === "balance") {
    return `${name}: int in 1000..100000`;
  }
  if (nameLower === "iban" || nameLower.includes("iban")) {
    return `${name}: faker.finance.iban()`;
  }
  if (nameLower === "bic" || nameLower === "swift" || nameLower.includes("swiftcode")) {
    return `${name}: faker.finance.bic()`;
  }
  if (nameLower.includes("accountnumber") || nameLower === "accountno") {
    return `${name}: faker.finance.accountNumber()`;
  }

  // Document fields
  if (nameLower === "description" || nameLower === "notes" || nameLower === "comment") {
    return `${name}: sentence()`;
  }

  // Status/Type fields (often have no enum but should)
  if (nameLower === "status" && schema.type === "string") {
    return `${name}: "ACTIVE" | "INACTIVE" | "PENDING"`;
  }
  if (nameLower === "type" && schema.type === "string" && !schema.enum) {
    return `${name}: "DEFAULT"`;
  }

  // Tag fields
  if (nameLower === "tag" && schema.type === "string") {
    return `${name}: alphanumeric(8)`;
  }

  // Fee/Group fields
  if (nameLower.includes("fee") || nameLower.includes("group")) {
    return `${name}: "DEFAULT" | "STANDARD" | "PREMIUM"`;
  }

  // Source fields
  if (nameLower.includes("sourceof") || nameLower.includes("source_of")) {
    return `${name}: "SALARY" | "SAVINGS" | "BUSINESS" | "INVESTMENT"`;
  }

  // Boolean fields don't need override - OpenAPI handles them
  if (schema.type === "boolean") return null;

  // Integer with bounds
  if (schema.type === "integer" && (constraints.minimum !== undefined || constraints.maximum !== undefined)) {
    const min = constraints.minimum ?? 0;
    const max = constraints.maximum ?? 1000000;
    return `${name}: int in ${min}..${max}`;
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

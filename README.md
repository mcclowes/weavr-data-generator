# Weavr Data Generator

Generate [Vague](https://github.com/mcclowes/vague) schemas from Weavr OpenAPI specifications for creating realistic JSON test fixtures.

## Quick Start

```bash
npm install
npm run build
npm start
```

## Usage

1. Run the CLI with your OpenAPI spec (defaults to `embedder.json`):
   ```bash
   npm start
   # or specify a custom spec
   npm start ./path/to/openapi.json
   ```

2. Select schemas interactively from the categorized list

3. Configure counts and output path

4. Edit the generated `.vague` file to customize field constraints

5. Generate JSON fixtures using the Vague CLI:
   ```bash
   npx vague ./output/fixtures.vague -o fixtures.json
   ```

## Workflow

```
embedder.json (OpenAPI) → weavr-gen → fixtures.vague → vague CLI → fixtures.json
```

The tool:
- Parses the OpenAPI spec and extracts schema definitions
- Converts OpenAPI schemas to Vague syntax with appropriate generators
- Handles `$ref` references, `oneOf`, `allOf`, enums, and nested objects
- Generates realistic data using Vague's faker integration

## Example Output

```vague
// The object representing a monetary amount in a particular currency.
schema CurrencyAmount {
  // Currency code
  currency: "EUR" | "GBP" | "USD"
  // The monetary amount, scaled to the lowest denomination
  amount: int in 1..10000
}

schema ManagedAccount {
  id: digits(10)
  profileId: digits(10)
  friendlyName: alphanumeric(50)
  currency: "EUR" | "GBP" | "USD"
  balances: ManagedInstrumentBalance
  state: "ACTIVE" | "BLOCKED" | "DESTROYED"
}

dataset WeavrFixtures {
  managedAccounts: 10 of ManagedAccount
}
```

## Development

```bash
npm run dev   # Watch mode
npm test      # Run tests
```

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

4. The tool generates a `.vague` file and automatically runs the Vague CLI to produce JSON fixtures

## Workflow

```
embedder.json (OpenAPI) → weavr-gen → fixtures.vague + fixtures.json
```

The tool:
- Imports the OpenAPI spec directly (no duplication)
- Generates schema extensions with smart field overrides
- Automatically runs Vague CLI to produce JSON fixtures

## Example Output

```vague
import weavr from "./embedder.json"

schema ManagedAccount from weavr.ManagedAccount {
  id: digits(12)
  // Add more field overrides as needed
}

schema User from weavr.User {
  email: email()
  locale: "en" | "en-GB" | "en-US" | "de" | "fr"
}

dataset WeavrFixtures {
  managedAccounts: 10 of ManagedAccount
  users: 10 of User
}
```

The generated `.vague` file imports from the OpenAPI spec and only includes field overrides where custom Vague generators improve data quality (emails, locales, numeric IDs, etc.).

## Development

```bash
npm run dev   # Watch mode
npm test      # Run tests
```

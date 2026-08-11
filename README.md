# Weavr Data Generator

Convert OpenAPI schemas into realistic JSON test data with [Vague](https://github.com/mcclowes/vague).

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

- Uses Vague to load and resolve the OpenAPI schemas
- Writes a small, reusable `.vague` dataset definition
- Uses Vague's Node API to generate JSON without spawning another process
- Accepts JSON or YAML OpenAPI documents supported by Vague

## Example Output

```vague
import weavr from "./embedder.json"

schema ManagedAccount from weavr.ManagedAccount {
  // Add Vague overrides here when the OAS constraints aren't enough
}

schema User from weavr.User {
  // For example: email: email()
}

dataset WeavrFixtures {
  managedAccounts: 10 of ManagedAccount
  users: 10 of User
}
```

The OpenAPI document remains the source of truth. Edit the generated `.vague` file when you want richer distributions, relationships, or field overrides, then run it again with Vague.

## Development

```bash
npm run dev   # Watch mode
npm run test:run
```

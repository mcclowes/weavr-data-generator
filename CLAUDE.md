# Weavr Data Generator

CLI tool that generates Vague schema files from Weavr OpenAPI specifications.

## Architecture

```
src/
├── types.ts      # TypeScript interfaces for OpenAPI and parsed schemas
├── parser.ts     # Vague-backed OpenAPI schema discovery and legacy parser API
├── generator.ts  # Writes Vague dataset definitions
├── vague.ts      # Generates and persists data through Vague's Node API
├── prompts.ts    # Interactive CLI prompts (inquirer)
├── cli.ts        # Entry point
└── index.ts      # Public API exports
```

## Commands

```bash
npm run build     # Compile TypeScript to dist/
npm run dev       # Watch mode
npm start         # Run CLI (interactive)
npm test          # Run vitest in watch mode
npm run test:run  # Run tests once
```

## Key Concepts

- **OpenAPI → data**: Vague loads OpenAPI 3.x schemas and generates the requested dataset
- **No subprocess**: Generation uses Vague's `fromFile` API directly
- **$ref resolution**: Follows `#/components/schemas/X` references to get actual constraints
- **Topological sort**: Outputs schemas in dependency order (dependencies before dependents)
- **Optional smart field overrides**: The public generator API can add Vague generators based on:
  - OpenAPI `format` (email, uuid, date-time, int64)
  - OpenAPI `pattern` regex (e.g., `^[0-9]+$` → `digits(12)`)
  - OpenAPI `enum` values → Vague superpositions
  - Field name heuristics (ipAddress, firstName, iban, etc.)
- **Let bindings**: Long enums (>5 values) are extracted to `let` declarations for readability
- **Faker integration**: Uses Vague's faker plugin for realistic data (email, phone, iban, etc.)

## Testing

Tests are in `src/__tests__/`. Run with `npm run test:run`.

## Output

Generated `.vague` files can also be run directly through the Vague CLI:
```bash
npx vague-lang output/fixtures.vague -o fixtures.json
```

Note: The embedder.json (OpenAPI spec) must be in the same directory as the .vague file, or use an absolute path in the import.

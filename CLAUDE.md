# Weavr Data Generator

CLI tool that generates Vague schema files from Weavr OpenAPI specifications.

## Architecture

```
src/
├── types.ts      # TypeScript interfaces for OpenAPI and parsed schemas
├── parser.ts     # OpenAPI spec loader and schema parser
├── generator.ts  # Converts parsed schemas to Vague syntax
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

- **OpenAPI → Vague**: Converts OpenAPI 3.x schemas to Vague declarative data generation syntax
- **$ref resolution**: Follows `#/components/schemas/X` references, tracking dependencies
- **Topological sort**: Outputs schemas in dependency order (dependencies before dependents)
- **Pattern mapping**: Translates OpenAPI patterns to Vague generators (e.g., `^[0-9]+$` → `digits(10)`)

## Testing

Tests are in `src/__tests__/`. Run with `npm run test:run`.

## Output

Generated `.vague` files should be run through the Vague CLI to produce JSON:
```bash
npx vague output/fixtures.vague -o fixtures.json
```

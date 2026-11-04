<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Database Migrations Protocol

- Whenever a database schema change or migration is needed:
  1. Author a structured, numbered migration file in `supabase/migrations/<timestamp>_<name>.sql`.
  2. Always execute the migration directly using the Supabase CLI:
     `npx supabase db query --remote --file supabase/migrations/<filename>.sql --yes`
  3. Verify the execution directly on the live database (inspect enum/table schemas, verify affected row counts, test writes).
  4. Do not ask the user to manually copy-paste SQL into the Supabase dashboard unless blocked by network or external authentication errors.

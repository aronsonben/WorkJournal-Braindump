This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Braindump Mode (New)

Braindump mode lets you quickly capture raw tasks (one per line), analyze them for categories, priorities, and duplicates, then commit them as structured tasks linked to a saved braindump session.

### Workflow
1. Toggle to Braindump mode via the header button (🧠 Braindump)
2. Paste or type tasks (one per line)
3. Click Analyze to get AI-assisted categorization (heuristic fallback if no Gemini key)
4. Review results: adjust category, priority, or drop/merge tasks
5. Commit to persist a `braindumps` row plus associated `tasks`

### Database Additions
See `database-migration-braindump.sql` for the new `braindumps` table and task columns:
- `braindump_id`, `category`, `original_line`, `merged_from`, `similarity_group`, `priority_explanation`

### Environment
Add `GEMINI_API_KEY` to `.env.local` (not exposed client-side). A fallback heuristic runs if absent.

### Testing
Run unit tests (utilities / parsing):
```
npm run test
```

### Future Enhancements
- True semantic duplicate detection (embedding similarity)
- Multi-braindump history view & diffing
- Drag-and-drop priority lane UI
- AI merge suggestions for overlapping tasks

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

PR Pilot is a Tauri desktop app (React + TypeScript frontend, Rust backend) for reviewing local git changes: pick a repo, compare two branches, and (in progress) get an AI-generated code review and PR title/description using a user-supplied LLM API key. `docs/prd.md` has the full product spec — treat it as aspirational/product-intent rather than a literal description of the implementation (e.g. it references SimpleGit and Zustand, neither of which is actually used). `docs/audit.md` is a manual test checklist; there is no automated test suite.

## Commands

- `npm run tauri dev` — run the full app (Rust backend + Vite frontend) in the Tauri window; this is the normal way to run it during development.
- `npm run dev` — Vite dev server only, no Tauri shell.
- `npm run build` — `tsc && vite build` (typecheck, then build the frontend bundle).
- `npm run tauri build` — full production desktop build.
- No lint, format, or test scripts are defined, and no test framework is configured. Validate changes by running the app and/or against `docs/audit.md`'s manual checklist.
- The Rust side (`src-tauri/`) can be checked independently with `cargo check` from that directory.

## Architecture

**Git operations live entirely in Rust**, exposed as Tauri commands in `src-tauri/src/lib.rs` (`is_git_repo`, `get_repo_info`, `list_branches`, `get_branch_diff_summary`, `get_branch_commits`, all using `git2`) and registered in `invoke_handler!` inside `run()`. The frontend never touches git directly — `src/lib/git.ts` wraps each command with `invoke()` and converts the Rust snake_case response shapes into camelCase TS types. To add a new git capability: add the `#[tauri::command]` in `lib.rs`, list it in `invoke_handler!`, then add a matching wrapper function + type in `git.ts`.

**Navigation is a linear wizard, not a general-purpose router.** `src/routes/steps.ts` defines the fixed step order (`/name → /folder → /branch → /review → /pr-description → /settings`), and `src/routes/root.tsx` reads that array to drive the back/forward chevron buttons in the header. Routes are declared with TanStack Router in `src/router.tsx`, using `createMemoryHistory` — there's no URL bar since this is a desktop window, and the `/` route just redirects to `/folder` or `/name` depending on whether a name is already saved.

**Persistence** goes through `src/lib/store.ts`, a thin wrapper around `@tauri-apps/plugin-store` (lazy-loaded singleton, disk-backed `pr-pilot.json`) exposing `getStoreValue`/`setStoreValue`. Keys currently in use: `name`, `activeFolder`, `recentFolders`, `baseBranch`, `compareBranch`, `aiApiConfig`. There's no Redux/Zustand/Context — each screen independently reads what it needs from the store in a `useEffect` on mount.

**AI integration is scaffolded but not implemented on `main`.** `src/routes/review.tsx` and `src/routes/pr-description.tsx` are currently placeholder screens. `src/routes/settings.tsx` already persists an OpenAI-compatible config (`apiUrl`, `apiKey`, `model`, `temperature`, `maxTokens`) under the `aiApiConfig` store key via a Zod-validated react-hook-form — this is the config future AI review/generation logic is expected to read. More advanced AI work exists on the `feat/ai-model-integration` branch; check there (or `git log --all`) before re-implementing AI review/PR-description logic from scratch.

**UI conventions**: `src/components/ui/` holds shadcn-generated primitives (Button, Card, Field, Select, Slider, etc.) — prefer composing these over raw markup. Some files there that look like simple icons (`cog.tsx`, `chevron-left.tsx`, `chevron-right.tsx`, `folder-git-2.tsx`) are actually animated icon components pulled from the `@lucide-animated` registry (see `components.json`), not plain `lucide-react` re-exports — follow that pattern (animated wrapper component in `components/ui/`) rather than importing icons straight from `lucide-react` inside screens. The path alias `@/*` maps to `src/*` (set in both `tsconfig.json` and `vite.config.ts`).

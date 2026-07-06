# PR Pilot

PR Pilot is a lightweight desktop app for reviewing your work before it becomes a pull request. Point it at a local git repository, compare two branches, and get an AI-generated code review and PR description — all running locally, with your own API key.

Built with [Tauri](https://tauri.app/) + React + TypeScript on the frontend and Rust (`git2`) for local git access.

## Screenshots

<!--
  Add app screenshots here, e.g.:
  ![Folder selection](docs/screenshots/folder.png)
  ![Branch comparison](docs/screenshots/branch.png)
  ![Settings](docs/screenshots/settings.png)
-->

## Features

- **Repository picker** — choose any local git repo and keep a recent-folders list for quick access
- **Repo overview** — current branch, remote, dirty state, ahead/behind tracking, contributor stats, repo size, and stale/merged branches
- **Branch comparison** — pick a base and compare branch, see commit count, files changed, and insertion/deletion stats
- **Commit timeline** — scrollable history of the current branch's commits
- **Configurable AI provider** — point at any OpenAI-compatible endpoint (model, temperature, max tokens), stored locally
- **AI code review** — sends the diff for analysis, with severity-tagged findings mapped to specific files/hunks and per-category quality scores
- **PR description generation** — AI-written title and description, honoring the repo's own PR template (or a fallback saved in Settings) and editable before use; can open a prefilled GitHub "Create PR" page directly

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/tools/install)
- Tauri's platform-specific system dependencies — see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/)

### Install

```bash
npm install
```

### Run in development

```bash
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

## Configuration

Open the in-app **Settings** screen to connect an AI provider:

- API URL (any OpenAI-compatible endpoint)
- API key
- Model identifier
- Temperature and max output tokens

Settings and recent folders are persisted locally via `tauri-plugin-store`; nothing is sent anywhere except the AI endpoint you configure.

## Tech Stack

- [Tauri 2](https://tauri.app/) + Rust (`git2` for git operations)
- React 19 + TypeScript + Vite
- [TanStack Router](https://tanstack.com/router)
- Tailwind CSS + shadcn/ui (Radix primitives)
- React Hook Form + Zod
- Motion (animations)

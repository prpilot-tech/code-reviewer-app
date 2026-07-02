# Code Review Tool - Product Requirements Document

**Timeline:** 30 days  
**Stack:** Tauri + React + shadcn + Tailwind  
**Scope:** AI-powered code diff analysis + PR generation  
**Target:** Personal use, local git repositories

---

## 🎯 Product Vision

A lightweight desktop app that analyzes code changes between git branches using AI, provides automated code reviews with improvement suggestions, and generates PR descriptions. All configuration stored locally for privacy.

---

## 📋 Core Features

### 1. Repository Management

**Overview:** Users can select and access local git repositories

**Requirements:**

- Browse filesystem to select a local git repository
- Store last 5 recently opened repositories
- Display on startup for quick access
- Show current repository name, remote URL, current branch
- Add/remove from recent list

**User value:** Faster workflow for frequent repos

---

### 2. Branch Viewer & Diff Display

**Overview:** Compare code between any two branches with syntax highlighting

**Requirements:**

- List all branches in selected repository
- Sort by last commit date
- Show last commit message and author
- Select two branches to compare
- Display unified or side-by-side diff view
- Show syntax highlighting for common languages (JavaScript, Python, Go, Rust, etc.)
- Display file list with change stats (additions, deletions)
- Handle large diffs gracefully (truncate or paginate)
- Show file change summary: total files, insertions, deletions

**User value:** Understand PR scope and code changes quickly

---

### 3. AI Code Analysis

**Overview:** Automated code review powered by Claude API

**Requirements:**

- Send code diff to Claude API (via user's API key in settings)
- Analyze for: bugs, performance issues, code quality, maintainability
- Display results with severity levels (Critical, Warning, Info)
- Map findings to specific lines in the diff
- Show detailed explanations for each finding
- Display estimated token usage and API call cost
- Handle API errors gracefully with user-friendly messages
- Support rate limiting (show remaining quota if available)
- Allow retry on failure

**User value:** Automated, consistent code quality feedback

---

### 4. PR Description Generator

**Overview:** Generate PR title and description from diff analysis

**Requirements:**

- Analyze code changes from diff
- Generate: PR title, summary, detailed description, testing notes
- Include statistics: files changed, lines added/removed, scope assessment
- Format as copyable text (user copies to GitHub/GitLab manually)
- Option to include AI analysis findings in description
- Allow manual editing before copying
- Save generated PR to clipboard in one click

**User value:** Reduce time writing boilerplate PR descriptions

---

### 5. Statistics & Metrics Dashboard

**Overview:** Display quantitative analysis of the branch comparison

**Requirements:**

- Total files changed counter
- Total lines added and removed
- Breakdown by file type (src/, tests/, docs/, config, etc.)
- Number of commits between branches
- Code complexity indicators (high, medium, low risk)
- Author/committer stats if relevant
- Visual chart of changes by category (optional)

**User value:** Quick risk assessment before review

---

### 6. Settings & Configuration

**Overview:** Centralized configuration for API access and behavior

**Requirements:**

- API provider selection (default: Anthropic, allow custom endpoint)
- API key input field (masked display, show last 4 characters)
- API base URL input (for custom endpoints)
- Model selection dropdown (Claude 3.5 Sonnet, Haiku, Opus, etc.)
- Review depth/verbosity preference (brief, standard, detailed)
- Option to include tests in analysis (yes/no)
- Save button to persist settings
- Reset to defaults button
- Show API key validation status (✓ valid / ✗ invalid)
- Display warning if API key not set

**User value:** Control costs, model behavior, privacy

---

## 💾 Local Storage & Configuration

### Config File Location

**Platform-independent:** `~/.codereview-app/config.json`

### Storage Method

Use simple JSON file stored in user's home directory. No database required for MVP.

### Why This Approach

- ✅ Cross-platform (Windows, Mac, Linux)
- ✅ No external dependencies
- ✅ Easy to backup/migrate
- ✅ Users can inspect/edit if needed
- ✅ Minimal security surface

### What Gets Stored

- API provider and base URL
- API key (encrypted or masked, never logged)
- Selected model name
- Review preferences (depth, include tests, etc.)
- List of recent repositories (paths only)
- Last opened repository
- App window size/position (optional)

### Security Requirements

- ❌ Never hardcode API keys
- ❌ Never log API keys to console or files
- ❌ Never use browser localStorage for sensitive data
- ✅ Store in ~/.codereview-app/ with restricted file permissions
- ✅ Mask API key in UI (show only last 4 characters)
- ✅ Validate API key before saving
- ✅ Clear key from memory after use

---

## 🗺️ Development Phases & Checklist

### Phase 1: Foundation (Days 1-5)

**Goal:** Tauri app running, settings working, config persisted

- [ ] Tauri project initialized with React
- [ ] shadcn/ui components installed and working
- [ ] Tailwind CSS configured
- [ ] File picker component for repo selection
- [ ] Settings page UI built (API key, URL, model inputs)
- [ ] Config file creation in ~/.codereview-app/
- [ ] Load config on app startup
- [ ] Save config on settings change
- [ ] Recent repos list displayed and clickable
- [ ] API key validation (attempt connection on save)

**Deliverable:** Can open app, configure API, select repo, see it persist

---

### Phase 2: Git Integration (Days 6-9)

**Goal:** Branch listing and diff retrieval working

- [ ] SimpleGit library integrated
- [ ] Get branches list from selected repo
- [ ] Display branches with last commit info
- [ ] Select two branches for comparison
- [ ] Retrieve diff between branches
- [ ] Extract file change statistics
- [ ] Handle git errors (bad repo, detached HEAD, etc.)
- [ ] Test on 3+ real repositories

**Deliverable:** Can see branches and get diff output

---

### Phase 3: Diff Viewer UI (Days 10-14)

**Goal:** Display diffs with syntax highlighting

- [ ] Diff viewer component integrated (react-diff-viewer-continued or equivalent)
- [ ] Render unified diff view
- [ ] Render side-by-side diff view (toggleable)
- [ ] Syntax highlighting for JS, Python, Go, Rust, TypeScript, etc.
- [ ] Line numbers visible
- [ ] File list with change stats displayed above diff
- [ ] Handle large diffs (truncate at 1MB with "show more" button)
- [ ] Handle binary files gracefully (show message, don't crash)
- [ ] Responsive layout for different screen sizes

**Deliverable:** View diffs clearly with syntax highlighting

---

### Phase 4: AI Analysis Integration (Days 15-20)

**Goal:** Connect to Claude API and display analysis

- [ ] Anthropic SDK integrated into React
- [ ] "Analyze with AI" button added to diff view
- [ ] Send diff + file context to Claude API
- [ ] Parse Claude response
- [ ] Display analysis results with severity levels
- [ ] Map findings to specific lines in diff
- [ ] Show detailed explanations for each finding
- [ ] Display token usage and estimated cost
- [ ] Handle API rate limiting
- [ ] Handle API timeouts (show retry option)
- [ ] Handle API errors (show helpful messages)
- [ ] Loading state while waiting for analysis

**Deliverable:** Click analyze → get AI code review

---

### Phase 5: PR Generation (Days 21-25)

**Goal:** Generate PR descriptions from diff analysis

- [ ] PR generation button added
- [ ] Generate PR title from diff/analysis
- [ ] Generate description: summary, changes, scope
- [ ] Generate testing notes section
- [ ] Option to include AI findings in description
- [ ] Format entire PR output as copyable text
- [ ] Copy to clipboard button (one-click)
- [ ] Show success notification after copy
- [ ] Display generated PR in editor/modal

**Deliverable:** Generate and copy PR descriptions

---

### Phase 6: Statistics Dashboard (Days 26-28)

**Goal:** Display quantitative metrics

- [ ] Files changed counter
- [ ] Lines added/removed counter
- [ ] Breakdown by file type
- [ ] Commit count calculator
- [ ] Code risk assessment (high/medium/low)
- [ ] Optional: visual chart of changes by category
- [ ] Display all stats on summary page

**Deliverable:** See repo metrics at a glance

---

### Phase 7: Polish & Testing (Days 29-30)

**Goal:** Ship stable MVP

- [ ] Test on 5+ real repositories
- [ ] Fix edge cases (binary files, huge diffs, weird git states)
- [ ] Test all error paths (bad API key, network down, etc.)
- [ ] Verify no crashes on typical usage
- [ ] UI polish (spacing, alignment, colors)
- [ ] Error messages are helpful and clear
- [ ] Loading states visible throughout
- [ ] Settings persist across app restarts
- [ ] Performance acceptable (<5 seconds per operation)

**Deliverable:** Shipping MVP

---

## 🎯 MVP Definition (What Ships)

### Included

- ✅ Open local git repo
- ✅ Select 2 branches, view diff
- ✅ Syntax highlighting in diff viewer
- ✅ AI code review analysis
- ✅ PR description generation
- ✅ Statistics dashboard
- ✅ Settings page (API config)
- ✅ Recent repos quick access
- ✅ Error handling for common issues

### Not Included (Post-MVP)

- ❌ Manual code annotations/comments
- ❌ Saving review history
- ❌ GitHub/GitLab API integration (can't push PRs directly)
- ❌ Multiple reviewers
- ❌ Export to PDF/markdown
- ❌ Keyboard shortcuts
- ❌ Dark mode
- ❌ Plugin system
- ❌ Blame view
- ❌ Commit history visualization

---

## 👥 User Workflows

### Workflow 1: Quick Code Review

1. Open app → select repo from recent list
2. Select two branches
3. View diff with syntax highlighting
4. Click "Analyze with AI"
5. Read code quality feedback
6. Done (takes ~2 minutes)

### Workflow 2: Generate PR Description

1. Open app → select repo
2. Select feature branch vs main
3. Click "Generate PR"
4. Review generated title and description
5. Copy to clipboard
6. Paste into GitHub/GitLab manually
7. Submit PR

### Workflow 3: Deep Analysis

1. Open app → select repo
2. View diff
3. Click "Analyze with AI" for detailed review
4. Read findings with line mapping
5. Take notes for code review
6. Write PR description with AI insights

---

## 🔧 Technical Decisions

### Framework: Tauri

- ✅ Smaller bundle size than Electron
- ✅ Better performance
- ✅ Native file system access
- ✅ Secure by default
- ⚠️ Smaller ecosystem (acceptable for MVP)

### Frontend: React + shadcn

- ✅ You already know React
- ✅ shadcn provides polished components
- ✅ Tailwind for consistent styling
- ✅ Easy to customize

### Git Operations: SimpleGit

- ✅ Simpler than nodegit
- ✅ Works cross-platform
- ✅ Wraps git CLI (requires system git installation)
- ✅ Fast and reliable

### Diff Display: react-diff-viewer-continued

- ✅ Maintained, actively used
- ✅ Supports syntax highlighting
- ✅ Handles large diffs well
- ✅ Alternative: build custom if needed

### State Management: Zustand or Context API

- Zustand: lightweight, explicit
- Context: built-in, no dependencies
- Recommendation: Start with Context, upgrade to Zustand if complex

### API Integration: Anthropic SDK

- ✅ Official library
- ✅ Handles auth and errors
- ✅ Types included
- ✅ Streaming support (nice to have)

### Local Storage: JSON file in ~/.codereview-app/

- ✅ Simple, cross-platform
- ✅ No database complexity
- ✅ Easy to debug and backup
- ✅ Works offline

---

## 📊 Success Criteria

### Functional

- ✅ Can open any local git repo
- ✅ Can view diffs between branches
- ✅ AI analysis runs without errors
- ✅ PR descriptions generate correctly
- ✅ Settings persist across app restarts

### Performance

- ✅ Diff loads in <5 seconds
- ✅ AI analysis completes in <15 seconds
- ✅ App startup in <2 seconds
- ✅ No memory leaks on repeated use

### Reliability

- ✅ Tested on 5+ real projects
- ✅ No crashes on edge cases
- ✅ All errors show helpful messages
- ✅ API failures handled gracefully

### Shipping

- ✅ Complete within 30 days
- ✅ All core features working
- ✅ Documentation in README
- ✅ Can build for Windows, Mac, Linux

---

## 🚀 Launch Requirements

Before shipping:

- [ ] Tested on 5+ real repositories
- [ ] Tested on Windows, Mac (and Linux if targeting)
- [ ] API key handling is secure (never logged)
- [ ] Settings page fully functional
- [ ] All error cases show friendly messages
- [ ] No console errors or warnings
- [ ] Build size reasonable (<150MB)
- [ ] README with setup instructions
- [ ] Installer/packaging for distribution

---

## 📝 Post-MVP Features (v1.1+)

### Quick Wins (1-2 days each)

- Dark mode
- Keyboard shortcuts (Ctrl+Enter to analyze, etc.)
- Review history (save past analyses)
- Export as markdown
- Syntax highlighting for more languages

### Medium Features (3-5 days each)

- GitHub/GitLab direct PR submission
- Inline annotations/comments (save notes)
- SQLite for persistent storage (upgrade from JSON)
- Multiple AI providers (OpenAI, local models)
- Caching of analysis results
- Blame view (who wrote this line?)

### Major Features (1+ week each)

- Web UI (ship browser version)
- Multi-user/team collaboration
- Integration with IDE (VS Code plugin)
- Commit history visualization
- Custom linting rules
- Plugin system

---

## 💭 Key Questions to Confirm

Before you start coding:

1. **API provider default:** Anthropic Claude only, or allow user to switch?
2. **Diff style:** Side-by-side default, or unified? (recommend side-by-side)
3. **Max diff size:** Truncate at 1MB? Warn user for large diffs?
4. **PR template:** Fixed format or customizable in settings?
5. **Language support:** Prioritize which languages for syntax highlighting?
6. **Cache results?** Save past AI analyses to avoid re-running?
7. **Dark mode:** Required for launch or post-MVP?

---

## 🚨 Known Risks & Mitigation

| Risk                                  | Severity | Mitigation                                                                   |
| ------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| Diff viewer performance on huge diffs | High     | Use proven library, truncate large files, lazy load                          |
| API costs spiral during testing       | High     | Set usage alerts, cap request size, cache results, test on small diffs first |
| Git operation failures (edge cases)   | Medium   | Validate repo state, wrap in error handling, test 5+ repos                   |
| API key exposure/security             | High     | Never log keys, mask in UI, store in home dir only, validate before save     |
| Tauri/Rust learning curve             | Medium   | Use template, start simple, focus on frontend first                          |
| shadcn component compatibility        | Low      | Components are stable, well-tested, mature                                   |

---

## 📅 Timeline Summary

| Phase              | Days  | Focus                             |
| ------------------ | ----- | --------------------------------- |
| 1: Foundation      | 1-5   | Settings, config, file picker     |
| 2: Git integration | 6-9   | Branch listing, diff retrieval    |
| 3: Diff viewer     | 10-14 | Display, syntax highlighting      |
| 4: AI analysis     | 15-20 | Claude API integration            |
| 5: PR generation   | 21-25 | Title, description, copyable text |
| 6: Statistics      | 26-28 | Metrics dashboard                 |
| 7: Polish          | 29-30 | Testing, bug fixes, ship          |

---

## ✅ Ready to Build

You have a clear scope, realistic timeline, defined features, and a phased approach. Start with Phase 1 (settings page) and work through each phase sequentially. Ship on day 30. Iterate post-launch.

**Good luck! 🚀**

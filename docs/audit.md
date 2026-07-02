# Code Review Tool - Test Cases (Concise)

## Phase 1: Settings & Config

- [ ] API key input and save works
- [ ] API key masked in UI (show last 4 chars)
- [ ] Config persists after app restart
- [ ] Recent repos list shows and persists
- [ ] Invalid API key shows validation error
- [ ] API URL setting works

## Phase 2: Git Integration

- [ ] Can open a local git repo
- [ ] Branch list shows all branches
- [ ] Current branch highlighted
- [ ] Select 2 branches → diff retrieved
- [ ] Handles detached HEAD gracefully
- [ ] Binary files don't crash (show "binary file" message)

## Phase 3: Diff Viewer

- [ ] Diff renders without crashing
- [ ] Syntax highlighting works (JS, Python, Go at minimum)
- [ ] Line numbers visible and accurate
- [ ] Added lines highlighted green, deleted lines red
- [ ] Large diffs (>1MB) truncate instead of crash
- [ ] Side-by-side or unified view works
- [ ] File list at top with change stats

## Phase 4: AI Analysis

- [ ] "Analyze with AI" button visible
- [ ] Loading state shown while API responds
- [ ] Results display with severity levels
- [ ] Invalid API key shows error
- [ ] Network timeout shows error with retry option
- [ ] API rate limit handled gracefully
- [ ] Token usage displayed

## Phase 5: PR Generation

- [ ] "Generate PR" button works
- [ ] Generates title + description
- [ ] Copy to clipboard button works
- [ ] Generated text can be pasted into GitHub/GitLab
- [ ] Includes file stats (insertions, deletions)

## Phase 6: Statistics

- [ ] Files changed count accurate
- [ ] Lines added/deleted count accurate
- [ ] File type breakdown shown
- [ ] No crashes on empty diff

## Integration & Edge Cases

- [ ] Full flow works: select repo → pick branches → view diff → analyze → generate PR
- [ ] Switching repos clears previous data
- [ ] No crashes on repos with 100K+ commits
- [ ] No crashes on repos with submodules
- [ ] API key change in settings affects next analysis
- [ ] App doesn't freeze during long operations
- [ ] All errors show helpful messages (not cryptic errors)

## Platform Testing

- [ ] Tested on Windows
- [ ] Tested on macOS
- [ ] File paths work correctly on each OS

## Pre-Ship

- [ ] Tested on 5+ real repositories
- [ ] No console errors or warnings
- [ ] Build completes without errors
- [ ] App launches in <2 seconds
- [ ] Diff loads in <5 seconds
- [ ] AI analysis completes in <15 seconds

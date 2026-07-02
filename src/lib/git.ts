import { invoke } from "@tauri-apps/api/core";

/** A git branch and its most recent commit metadata. */
export interface BranchInfo {
  name: string;
  isHead: boolean;
  lastCommitMessage: string;
  lastCommitAuthor: string;
  lastCommitTimestamp: number;
}

/** Snake-case shape returned by the Tauri `list_branches` command. */
interface RawBranchInfo {
  name: string;
  is_head: boolean;
  last_commit_message: string;
  last_commit_author: string;
  last_commit_timestamp: number;
}

/**
 * Checks whether the directory at `path` is a git repository.
 */
export async function isGitRepo(path: string): Promise<boolean> {
  return invoke<boolean>("is_git_repo", { path });
}

/**
 * Lists all branches in the repository at `path`, converting the raw
 * snake_case Tauri response into camelCase {@link BranchInfo} objects.
 */
export async function listBranches(path: string): Promise<BranchInfo[]> {
  const raw = await invoke<RawBranchInfo[]>("list_branches", { path });
  return raw.map((branch) => ({
    name: branch.name,
    isHead: branch.is_head,
    lastCommitMessage: branch.last_commit_message,
    lastCommitAuthor: branch.last_commit_author,
    lastCommitTimestamp: branch.last_commit_timestamp,
  }));
}

/** A repository contributor and their commit count. */
export interface Contributor {
  name: string;
  commitCount: number;
}

/** Summary information about a git repository. */
export interface RepoInfo {
  name: string;
  remoteUrl: string | null;
  currentBranch: string;
  isDirty: boolean;
  ahead: number | null;
  behind: number | null;
  totalCommits: number;
  contributors: Contributor[];
  repoSizeBytes: number;
  staleBranches: string[];
}

/** Snake-case shape returned by the Tauri `get_repo_info` command. */
interface RawRepoInfo {
  name: string;
  remote_url: string | null;
  current_branch: string;
  is_dirty: boolean;
  ahead: number | null;
  behind: number | null;
  total_commits: number;
  contributors: { name: string; commit_count: number }[];
  repo_size_bytes: number;
  stale_branches: string[];
}

/**
 * Fetches summary information (branch, dirty state, contributors, etc.)
 * for the repository at `path`.
 */
export async function getRepoInfo(path: string): Promise<RepoInfo> {
  const raw = await invoke<RawRepoInfo>("get_repo_info", { path });
  return {
    name: raw.name,
    remoteUrl: raw.remote_url,
    currentBranch: raw.current_branch,
    isDirty: raw.is_dirty,
    ahead: raw.ahead,
    behind: raw.behind,
    totalCommits: raw.total_commits,
    contributors: raw.contributors.map((c) => ({
      name: c.name,
      commitCount: c.commit_count,
    })),
    repoSizeBytes: raw.repo_size_bytes,
    staleBranches: raw.stale_branches,
  };
}

/** Aggregate diff stats between two branches. */
export interface BranchDiffSummary {
  commitCount: number;
  filesChanged: number;
  insertions: number;
  deletions: number;
}

/** Snake-case shape returned by the Tauri `get_branch_diff_summary` command. */
interface RawBranchDiffSummary {
  commit_count: number;
  files_changed: number;
  insertions: number;
  deletions: number;
}

/**
 * Computes diff statistics (commits, files changed, insertions/deletions)
 * between `base` and `compare` in the repository at `path`.
 */
export async function getBranchDiffSummary(
  path: string,
  base: string,
  compare: string,
): Promise<BranchDiffSummary> {
  const raw = await invoke<RawBranchDiffSummary>("get_branch_diff_summary", {
    path,
    base,
    compare,
  });
  return {
    commitCount: raw.commit_count,
    filesChanged: raw.files_changed,
    insertions: raw.insertions,
    deletions: raw.deletions,
  };
}

/** A single commit on the current branch's history. */
export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  timestamp: number;
}

/**
 * Fetches the most recent commits (up to `limit`) reachable from HEAD in
 * the repository at `path`, newest first.
 */
export async function getBranchCommits(
  path: string,
  limit = 30,
): Promise<CommitInfo[]> {
  return invoke<CommitInfo[]>("get_branch_commits", { path, limit });
}

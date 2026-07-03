use std::cell::RefCell;
use std::collections::HashMap;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn is_git_repo(path: String) -> bool {
    git2::Repository::open(&path).is_ok()
}

fn dir_size_bytes(path: &std::path::Path) -> u64 {
    let mut total = 0u64;
    let Ok(entries) = std::fs::read_dir(path) else {
        return 0;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            total += dir_size_bytes(&path);
        } else if let Ok(metadata) = entry.metadata() {
            total += metadata.len();
        }
    }
    total
}

#[derive(serde::Serialize)]
struct ContributorInfo {
    name: String,
    commit_count: usize,
}

#[derive(serde::Serialize)]
struct RepoInfo {
    name: String,
    remote_url: Option<String>,
    current_branch: String,
    is_dirty: bool,
    ahead: Option<usize>,
    behind: Option<usize>,
    total_commits: usize,
    contributors: Vec<ContributorInfo>,
    repo_size_bytes: u64,
    stale_branches: Vec<String>,
}

#[tauri::command]
fn get_repo_info(path: String) -> Result<RepoInfo, String> {
    let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;

    let name = std::path::Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let remote_url = repo
        .find_remote("origin")
        .ok()
        .and_then(|r| r.url().map(String::from));

    let head = repo.head().map_err(|e| e.to_string())?;
    let current_branch = head.shorthand().unwrap_or("HEAD").to_string();
    let head_oid = head.peel_to_commit().map_err(|e| e.to_string())?.id();

    let mut status_opts = git2::StatusOptions::new();
    status_opts.include_untracked(true);
    let is_dirty = !repo
        .statuses(Some(&mut status_opts))
        .map_err(|e| e.to_string())?
        .is_empty();

    let (ahead, behind) = if let Ok(head_branch) = repo.find_branch(&current_branch, git2::BranchType::Local) {
        if let Ok(upstream) = head_branch.upstream() {
            if let Ok(upstream_oid) = upstream.get().peel_to_commit().map(|c| c.id()) {
                match repo.graph_ahead_behind(head_oid, upstream_oid) {
                    Ok((a, b)) => (Some(a), Some(b)),
                    Err(_) => (None, None),
                }
            } else {
                (None, None)
            }
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push(head_oid).map_err(|e| e.to_string())?;
    let mut total_commits = 0usize;
    let mut contributor_counts: HashMap<String, usize> = HashMap::new();
    for oid in revwalk {
        let oid = oid.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        total_commits += 1;
        let author = commit.author().name().unwrap_or("Unknown").to_string();
        *contributor_counts.entry(author).or_insert(0) += 1;
    }
    let mut contributors: Vec<ContributorInfo> = contributor_counts
        .into_iter()
        .map(|(name, commit_count)| ContributorInfo { name, commit_count })
        .collect();
    contributors.sort_by(|a, b| b.commit_count.cmp(&a.commit_count));
    contributors.truncate(5);

    let mut stale_branches = Vec::new();
    let branches = repo
        .branches(Some(git2::BranchType::Local))
        .map_err(|e| e.to_string())?;
    for branch in branches {
        let (branch, _) = branch.map_err(|e| e.to_string())?;
        if branch.is_head() {
            continue;
        }
        let branch_name = branch.name().map_err(|e| e.to_string())?.unwrap_or("").to_string();
        if let Ok(branch_oid) = branch.get().peel_to_commit().map(|c| c.id()) {
            if repo.graph_descendant_of(head_oid, branch_oid).unwrap_or(false) {
                stale_branches.push(branch_name);
            }
        }
    }

    let repo_size_bytes = dir_size_bytes(repo.path());

    Ok(RepoInfo {
        name,
        remote_url,
        current_branch,
        is_dirty,
        ahead,
        behind,
        total_commits,
        contributors,
        repo_size_bytes,
        stale_branches,
    })
}

#[derive(serde::Serialize)]
struct BranchDiffSummary {
    commit_count: usize,
    files_changed: usize,
    insertions: usize,
    deletions: usize,
}

#[tauri::command]
fn get_branch_diff_summary(
    path: String,
    base: String,
    compare: String,
) -> Result<BranchDiffSummary, String> {
    let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;

    let base_oid = repo
        .revparse_single(&base)
        .map_err(|e| e.to_string())?
        .peel_to_commit()
        .map_err(|e| e.to_string())?
        .id();
    let compare_oid = repo
        .revparse_single(&compare)
        .map_err(|e| e.to_string())?
        .peel_to_commit()
        .map_err(|e| e.to_string())?
        .id();
    let merge_base_oid = repo
        .merge_base(base_oid, compare_oid)
        .map_err(|e| e.to_string())?;

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push(compare_oid).map_err(|e| e.to_string())?;
    revwalk.hide(merge_base_oid).map_err(|e| e.to_string())?;
    let commit_count = revwalk.count();

    let merge_base_tree = repo
        .find_commit(merge_base_oid)
        .map_err(|e| e.to_string())?
        .tree()
        .map_err(|e| e.to_string())?;
    let compare_tree = repo
        .find_commit(compare_oid)
        .map_err(|e| e.to_string())?
        .tree()
        .map_err(|e| e.to_string())?;
    let diff = repo
        .diff_tree_to_tree(Some(&merge_base_tree), Some(&compare_tree), None)
        .map_err(|e| e.to_string())?;
    let stats = diff.stats().map_err(|e| e.to_string())?;

    Ok(BranchDiffSummary {
        commit_count,
        files_changed: stats.files_changed(),
        insertions: stats.insertions(),
        deletions: stats.deletions(),
    })
}

#[derive(serde::Serialize)]
struct DiffHunk {
    id: String,
    header: String,
    content: String,
}

#[derive(serde::Serialize)]
struct DiffFileDetail {
    path: String,
    old_path: Option<String>,
    status: String,
    is_binary: bool,
    hunks: Vec<DiffHunk>,
}

#[derive(serde::Serialize)]
struct BranchDiffDetail {
    files: Vec<DiffFileDetail>,
    truncated: bool,
}

#[derive(Default)]
struct DiffWalkState {
    files: Vec<DiffFileDetail>,
    truncated: bool,
    bytes_used: usize,
    hunks_used: usize,
}

const MAX_DIFF_BYTES: usize = 200_000;
const MAX_HUNKS: usize = 400;

#[tauri::command]
fn get_branch_diff_detail(
    path: String,
    base: String,
    compare: String,
) -> Result<BranchDiffDetail, String> {
    let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;

    let base_oid = repo
        .revparse_single(&base)
        .map_err(|e| e.to_string())?
        .peel_to_commit()
        .map_err(|e| e.to_string())?
        .id();
    let compare_oid = repo
        .revparse_single(&compare)
        .map_err(|e| e.to_string())?
        .peel_to_commit()
        .map_err(|e| e.to_string())?
        .id();
    let merge_base_oid = repo
        .merge_base(base_oid, compare_oid)
        .map_err(|e| e.to_string())?;

    let merge_base_tree = repo
        .find_commit(merge_base_oid)
        .map_err(|e| e.to_string())?
        .tree()
        .map_err(|e| e.to_string())?;
    let compare_tree = repo
        .find_commit(compare_oid)
        .map_err(|e| e.to_string())?
        .tree()
        .map_err(|e| e.to_string())?;
    let diff = repo
        .diff_tree_to_tree(Some(&merge_base_tree), Some(&compare_tree), None)
        .map_err(|e| e.to_string())?;

    let state = RefCell::new(DiffWalkState::default());

    let mut file_cb = |delta: git2::DiffDelta, _progress: f32| -> bool {
        let mut state = state.borrow_mut();
        let status = match delta.status() {
            git2::Delta::Added => "added",
            git2::Delta::Deleted => "deleted",
            git2::Delta::Renamed | git2::Delta::Copied => "renamed",
            _ => "modified",
        }
        .to_string();

        let new_file_path = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string());
        let old_file_path = delta
            .old_file()
            .path()
            .map(|p| p.to_string_lossy().to_string());
        let file_path = new_file_path
            .clone()
            .or_else(|| old_file_path.clone())
            .unwrap_or_default();
        let old_path = if status == "renamed" && old_file_path != Some(file_path.clone()) {
            old_file_path
        } else {
            None
        };

        state.files.push(DiffFileDetail {
            path: file_path,
            old_path,
            status,
            is_binary: delta.flags().is_binary(),
            hunks: Vec::new(),
        });
        true
    };

    let mut hunk_cb = |_delta: git2::DiffDelta, hunk: git2::DiffHunk| -> bool {
        let mut state = state.borrow_mut();
        if state.hunks_used >= MAX_HUNKS {
            state.truncated = true;
            return true;
        }
        let file_index = state.files.len().saturating_sub(1);
        let hunk_index = state.files.last().map(|f| f.hunks.len()).unwrap_or(0);
        let header = String::from_utf8_lossy(hunk.header())
            .trim_end()
            .to_string();
        if let Some(file) = state.files.last_mut() {
            file.hunks.push(DiffHunk {
                id: format!("{}-{}", file_index, hunk_index),
                header,
                content: String::new(),
            });
        }
        state.hunks_used += 1;
        true
    };

    let mut line_cb =
        |_delta: git2::DiffDelta, _hunk: Option<git2::DiffHunk>, line: git2::DiffLine| -> bool {
            let mut state = state.borrow_mut();
            let prefix = match line.origin() {
                '+' => "+",
                '-' => "-",
                _ => " ",
            };
            let text = String::from_utf8_lossy(line.content())
                .trim_end_matches('\n')
                .to_string();
            let line_bytes = prefix.len() + text.len() + 1;
            if state.bytes_used + line_bytes > MAX_DIFF_BYTES {
                state.truncated = true;
                return true;
            }
            state.bytes_used += line_bytes;
            if let Some(file) = state.files.last_mut() {
                if let Some(hunk) = file.hunks.last_mut() {
                    hunk.content.push_str(prefix);
                    hunk.content.push_str(&text);
                    hunk.content.push('\n');
                }
            }
            true
        };

    diff.foreach(&mut file_cb, None, Some(&mut hunk_cb), Some(&mut line_cb))
        .map_err(|e| e.to_string())?;

    let state = state.into_inner();
    Ok(BranchDiffDetail {
        files: state.files,
        truncated: state.truncated,
    })
}

#[derive(serde::Serialize)]
struct BranchInfo {
    name: String,
    is_head: bool,
    last_commit_message: String,
    last_commit_author: String,
    last_commit_timestamp: i64,
}

#[tauri::command]
fn list_branches(path: String) -> Result<Vec<BranchInfo>, String> {
    let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
    let branches = repo
        .branches(Some(git2::BranchType::Local))
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for branch in branches {
        let (branch, _) = branch.map_err(|e| e.to_string())?;
        let name = branch
            .name()
            .map_err(|e| e.to_string())?
            .unwrap_or("")
            .to_string();
        let is_head = branch.is_head();
        let commit = branch
            .get()
            .peel_to_commit()
            .map_err(|e| e.to_string())?;

        result.push(BranchInfo {
            name,
            is_head,
            last_commit_message: commit.summary().unwrap_or("").to_string(),
            last_commit_author: commit.author().name().unwrap_or("").to_string(),
            last_commit_timestamp: commit.time().seconds(),
        });
    }

    result.sort_by(|a, b| b.last_commit_timestamp.cmp(&a.last_commit_timestamp));
    Ok(result)
}

#[derive(serde::Serialize)]
struct CommitInfo {
    hash: String,
    message: String,
    author: String,
    timestamp: i64,
}

#[tauri::command]
fn get_branch_commits(path: String, limit: usize) -> Result<Vec<CommitInfo>, String> {
    let repo = git2::Repository::open(&path).map_err(|e| e.to_string())?;
    let head_oid = repo
        .head()
        .map_err(|e| e.to_string())?
        .peel_to_commit()
        .map_err(|e| e.to_string())?
        .id();

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push(head_oid).map_err(|e| e.to_string())?;

    let mut commits = Vec::new();
    for oid in revwalk.take(limit) {
        let oid = oid.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        commits.push(CommitInfo {
            hash: oid.to_string()[..7].to_string(),
            message: commit.summary().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("Unknown").to_string(),
            timestamp: commit.time().seconds(),
        });
    }

    Ok(commits)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            is_git_repo,
            list_branches,
            get_repo_info,
            get_branch_diff_summary,
            get_branch_diff_detail,
            get_branch_commits
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

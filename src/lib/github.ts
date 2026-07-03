/** Owner and repository name parsed from a GitHub remote URL. */
export interface GithubRepoRef {
  owner: string;
  repo: string;
}

/**
 * Parses a git remote URL (SSH or HTTPS form) into a GitHub owner/repo
 * pair. Returns `null` for non-GitHub remotes or unrecognized formats.
 */
export function parseGithubRemote(remoteUrl: string | null): GithubRepoRef | null {
  if (!remoteUrl) return null;

  const sshMatch = remoteUrl.match(/^git@github\.com:([^/]+)\/(.+?)(\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

  const httpsMatch = remoteUrl.match(
    /^https?:\/\/(?:[^/@]+@)?github\.com\/([^/]+)\/(.+?)(\.git)?\/?$/,
  );
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };

  return null;
}

/**
 * Builds a GitHub "compare" URL that opens the new-PR form prefilled with
 * a title and body, for the given base/compare branches.
 */
export function buildComparePrUrl(
  ref: GithubRepoRef,
  base: string,
  compare: string,
  title: string,
  body: string,
): string {
  const params = new URLSearchParams({ expand: "1", title, body });
  return `https://github.com/${ref.owner}/${ref.repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(compare)}?${params.toString()}`;
}

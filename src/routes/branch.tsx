import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getBranchCommits,
  getBranchDiffSummary,
  getRepoInfo,
  listBranches,
  type BranchDiffSummary,
  type BranchInfo,
  type CommitInfo,
  type RepoInfo,
} from "@/lib/git";
import { getStoreValue, setStoreValue } from "@/lib/store";
import { formatBytes, formatExactDate, formatRelativeTime } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import {
  ArrowDown,
  ArrowUp,
  GitBranch,
  GitCompare,
  History,
  Users,
} from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useEffect, useState } from "react";

const ACTIVE_FOLDER_KEY = "activeFolder";
const BASE_BRANCH_KEY = "baseBranch";
const COMPARE_BRANCH_KEY = "compareBranch";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: index * 0.08, ease: "easeOut" },
  }),
};

const COMMIT_DOT_COLORS = [
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

function commitDotColor(hash: string) {
  let sum = 0;
  for (let i = 0; i < hash.length; i++) sum += hash.charCodeAt(i);
  return COMMIT_DOT_COLORS[sum % COMMIT_DOT_COLORS.length];
}

function BranchScreen() {
  const navigate = useNavigate();
  const [folder, setFolder] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [baseBranch, setBaseBranch] = useState<string>("");
  const [compareBranch, setCompareBranch] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diffSummary, setDiffSummary] = useState<BranchDiffSummary | null>(
    null,
  );
  const [diffLoading, setDiffLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const activeFolder = await getStoreValue<string>(ACTIVE_FOLDER_KEY);
      setFolder(activeFolder ?? null);
      if (!activeFolder) {
        setLoading(false);
        return;
      }

      try {
        const [result, info, commitList] = await Promise.all([
          listBranches(activeFolder),
          getRepoInfo(activeFolder),
          getBranchCommits(activeFolder),
        ]);
        setBranches(result);
        setRepoInfo(info);
        setCommits(commitList);

        const [savedBase, savedCompare] = await Promise.all([
          getStoreValue<string>(BASE_BRANCH_KEY),
          getStoreValue<string>(COMPARE_BRANCH_KEY),
        ]);
        const head = result.find((b) => b.isHead)?.name ?? result[0]?.name;
        const other = result.find((b) => b.name !== head)?.name;

        setBaseBranch(
          savedBase && result.some((b) => b.name === savedBase)
            ? savedBase
            : (head ?? ""),
        );
        setCompareBranch(
          savedCompare && result.some((b) => b.name === savedCompare)
            ? savedCompare
            : (other ?? ""),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canGenerate =
    !!baseBranch && !!compareBranch && baseBranch !== compareBranch;

  useEffect(() => {
    if (!folder || !canGenerate) {
      setDiffSummary(null);
      return;
    }
    let cancelled = false;
    setDiffLoading(true);
    getBranchDiffSummary(folder, baseBranch, compareBranch)
      .then((summary) => {
        if (!cancelled) setDiffSummary(summary);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [folder, baseBranch, compareBranch, canGenerate]);

  const handleGenerateReview = async () => {
    await Promise.all([
      setStoreValue(BASE_BRANCH_KEY, baseBranch),
      setStoreValue(COMPARE_BRANCH_KEY, compareBranch),
    ]);
    navigate({ to: "/review" });
  };

  if (!loading && !folder) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Select a folder first before comparing branches.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-4xl space-y-6 px-4">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-medium">Compare Branches</h1>
          <p className="text-muted-foreground text-sm">
            Choose two branches to review the changes between them.
          </p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="text-destructive text-sm"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {repoInfo && (
              <motion.div
                custom={0}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className="border-border bg-card space-y-3 rounded-3xl border p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-xl">
                      <GitBranch className="text-foreground size-4" />
                    </div>
                    <span className="truncate text-sm font-semibold">
                      {repoInfo.name}
                    </span>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      repoInfo.isDirty
                        ? "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400 dark:ring-amber-400/20"
                        : "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400 dark:ring-emerald-400/20"
                    }`}
                  >
                    {repoInfo.isDirty ? "Uncommitted changes" : "Clean"}
                  </span>
                </div>

                <div className="text-muted-foreground grid grid-cols-2 gap-y-1.5 text-xs">
                  <span>Branch</span>
                  <span className="text-foreground text-right font-mono">
                    {repoInfo.currentBranch}
                  </span>

                  <span>Remote</span>
                  <span className="text-foreground truncate text-right font-mono">
                    {repoInfo.remoteUrl ?? "No remote configured"}
                  </span>

                  {(repoInfo.ahead !== null || repoInfo.behind !== null) && (
                    <>
                      <span>Tracking</span>
                      <span className="text-foreground flex items-center justify-end gap-2 text-right">
                        <span className="flex items-center gap-0.5">
                          <ArrowUp className="size-3" />
                          {repoInfo.ahead ?? 0}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <ArrowDown className="size-3" />
                          {repoInfo.behind ?? 0}
                        </span>
                      </span>
                    </>
                  )}

                  <span>Commits</span>
                  <span className="text-foreground text-right">
                    {repoInfo.totalCommits}
                  </span>

                  <span>Repo size</span>
                  <span className="text-foreground text-right">
                    {formatBytes(repoInfo.repoSizeBytes)}
                  </span>

                  {repoInfo.staleBranches.length > 0 && (
                    <>
                      <span>Merged branches</span>
                      <span className="text-foreground text-right">
                        {repoInfo.staleBranches.length} can be cleaned up
                      </span>
                    </>
                  )}
                </div>

                {repoInfo.contributors.length > 0 && (
                  <div className="border-border/70 flex items-center gap-1.5 border-t pt-2.5 text-xs">
                    <Users className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="text-muted-foreground truncate">
                      {repoInfo.contributors
                        .map((c) => `${c.name} (${c.commitCount})`)
                        .join(", ")}
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            <motion.div
              custom={1}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="border-border bg-card space-y-4 rounded-3xl border p-5 shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-xl">
                  <GitCompare className="size-4" />
                </div>
                <span className="text-sm font-semibold">Review setup</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="base-branch">Base branch</Label>
                <Select value={baseBranch} onValueChange={setBaseBranch}>
                  <SelectTrigger id="base-branch" className="w-full">
                    <SelectValue placeholder="Select base branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.name} value={branch.name}>
                        {branch.name}
                        {branch.isHead ? " (current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="compare-branch">Compare branch</Label>
                <Select value={compareBranch} onValueChange={setCompareBranch}>
                  <SelectTrigger id="compare-branch" className="w-full">
                    <SelectValue placeholder="Select compare branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.name} value={branch.name}>
                        {branch.name}
                        {branch.isHead ? " (current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {canGenerate && (
                  <motion.p
                    key={
                      diffLoading
                        ? "loading"
                        : (diffSummary?.commitCount ?? "empty")
                    }
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="text-muted-foreground text-center text-xs"
                  >
                    {diffLoading
                      ? "Calculating diff…"
                      : diffSummary
                        ? `${diffSummary.commitCount} commit${diffSummary.commitCount === 1 ? "" : "s"} • ${diffSummary.filesChanged} file${diffSummary.filesChanged === 1 ? "" : "s"} changed • +${diffSummary.insertions} / -${diffSummary.deletions}`
                        : null}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.div
                whileHover={canGenerate ? { scale: 1.015 } : undefined}
                whileTap={canGenerate ? { scale: 0.985 } : undefined}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <Button
                  className="w-full"
                  disabled={!canGenerate}
                  onClick={handleGenerateReview}
                >
                  <GitCompare data-icon="inline-start" />
                  Generate Review
                </Button>
              </motion.div>
            </motion.div>
          </div>

          {commits.length > 0 && (
            <motion.div
              custom={2}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="border-border bg-card space-y-3 rounded-3xl border p-5 shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-xl">
                  <History className="text-foreground size-4" />
                </div>
                <span className="text-sm font-semibold">
                  Timeline
                  {repoInfo && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {repoInfo.currentBranch}
                    </span>
                  )}
                </span>
              </div>

              <ScrollArea className="h-100">
                <Timeline defaultValue={commits.length} className="pr-2">
                  {commits.map((commit, index) => (
                    <TimelineItem
                      key={commit.hash}
                      step={index + 1}
                      className="animate-in fade-in slide-in-from-left-2 fill-mode-both duration-300"
                      style={{
                        animationDelay: `${Math.min(index * 40, 480)}ms`,
                      }}
                    >
                      <TimelineHeader>
                        <TimelineSeparator />
                        <TimelineIndicator
                          className="border-transparent"
                          style={{
                            backgroundColor: commitDotColor(commit.hash),
                          }}
                        />
                      </TimelineHeader>
                      <TimelineContent>
                        <div className="border-border/70 bg-muted/40 hover:bg-muted/60 rounded-xl border p-3 transition-colors">
                          <TimelineDate
                            dateTime={dayjs
                              .unix(commit.timestamp)
                              .toISOString()}
                            title={formatExactDate(commit.timestamp)}
                          >
                            {formatRelativeTime(commit.timestamp)} ·{" "}
                            {formatExactDate(commit.timestamp)}
                          </TimelineDate>
                          <TimelineTitle className="pr-1 line-clamp-3">
                            {commit.message}
                          </TimelineTitle>
                          <div className="border-border/60 mt-2 flex items-center justify-between gap-2 border-t pt-2 text-xs">
                            <span className="text-muted-foreground truncate">
                              {commit.author}
                            </span>
                            <span className="text-muted-foreground/80 shrink-0 font-mono text-[11px]">
                              {commit.hash}
                            </span>
                          </div>
                        </div>
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </Timeline>
              </ScrollArea>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BranchScreen;

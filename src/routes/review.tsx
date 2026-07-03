import { Button } from "@/components/ui/button";
import {
  buildReviewItems,
  generateReview,
  loadAiApiConfig,
  type AiReviewResponse,
  type Severity,
} from "@/lib/ai";
import { getBranchDiffDetail, type BranchDiffDetail } from "@/lib/git";
import { getStoreValue } from "@/lib/store";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  GitCompare,
  GitPullRequest,
  Info,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { motion, type Variants } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

const ACTIVE_FOLDER_KEY = "activeFolder";
const BASE_BRANCH_KEY = "baseBranch";
const COMPARE_BRANCH_KEY = "compareBranch";

type ScreenState =
  | { status: "loading"; label: string }
  | { status: "missing-selection" }
  | { status: "not-configured" }
  | { status: "no-changes" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      diff: BranchDiffDetail;
      review: AiReviewResponse;
      base: string;
      compare: string;
    };

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: index * 0.06, ease: "easeOut" },
  }),
};

const METRICS: { key: keyof AiReviewResponse["metrics"]; label: string }[] = [
  { key: "codeQuality", label: "Code Quality" },
  { key: "security", label: "Security" },
  { key: "maintainability", label: "Maintainability" },
  { key: "performance", label: "Performance" },
  { key: "testCoverage", label: "Test Coverage" },
];

const SEVERITY_META: Record<
  Severity,
  {
    label: string;
    icon: typeof AlertTriangle;
    borderClassName: string;
    textClassName: string;
    badgeClassName: string;
    avatarClassName: string;
  }
> = {
  critical: {
    label: "Critical",
    icon: AlertTriangle,
    borderClassName: "border-l-rose-500",
    textClassName: "text-rose-600 dark:text-rose-400",
    badgeClassName: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    avatarClassName: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  warning: {
    label: "Warning",
    icon: AlertCircle,
    borderClassName: "border-l-amber-500",
    textClassName: "text-amber-600 dark:text-amber-400",
    badgeClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    avatarClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  suggestion: {
    label: "Suggestion",
    icon: Lightbulb,
    borderClassName: "border-l-sky-500",
    textClassName: "text-sky-600 dark:text-sky-400",
    badgeClassName: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    avatarClassName: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  info: {
    label: "Info",
    icon: Info,
    borderClassName: "border-l-border",
    textClassName: "text-muted-foreground",
    badgeClassName: "bg-muted text-muted-foreground",
    avatarClassName: "bg-muted text-muted-foreground",
  },
};

function scoreColorClass(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function diffLineStats(diff: BranchDiffDetail) {
  let insertions = 0;
  let deletions = 0;
  for (const file of diff.files) {
    for (const hunk of file.hunks) {
      for (const line of hunk.content.split("\n")) {
        if (line.startsWith("+")) insertions++;
        else if (line.startsWith("-")) deletions++;
      }
    }
  }
  return { insertions, deletions, filesChanged: diff.files.length };
}

function CountUpNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 800;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(progress * value));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className={className}>{display}</span>;
}

function DiffSnippet({
  header,
  content,
}: {
  header: string;
  content: string;
}) {
  const lines = content.split("\n").filter((line) => line.length > 0);
  return (
    <div className="overflow-hidden rounded-t-2xl border border-b-0 border-border/70">
      <div className="text-muted-foreground bg-muted/40 px-3 py-1.5 font-mono text-xs">
        {header}
      </div>
      <pre className="overflow-x-auto p-0 text-xs leading-relaxed">
        <code>
          {lines.map((line, index) => {
            const isAdd = line.startsWith("+");
            const isDel = line.startsWith("-");
            return (
              <div
                key={index}
                className={
                  isAdd
                    ? "bg-emerald-500/10 px-3 py-0.5 font-mono text-emerald-700 dark:text-emerald-400"
                    : isDel
                      ? "bg-rose-500/10 px-3 py-0.5 font-mono text-rose-700 dark:text-rose-400"
                      : "text-muted-foreground px-3 py-0.5 font-mono"
                }
              >
                {line}
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

function ReviewScreen() {
  const navigate = useNavigate();
  const [state, setState] = useState<ScreenState>({
    status: "loading",
    label: "Reading the diff…",
  });

  const runReview = useCallback(async () => {
    setState({ status: "loading", label: "Reading the diff…" });

    const [folder, baseBranch, compareBranch] = await Promise.all([
      getStoreValue<string>(ACTIVE_FOLDER_KEY),
      getStoreValue<string>(BASE_BRANCH_KEY),
      getStoreValue<string>(COMPARE_BRANCH_KEY),
    ]);

    if (!folder || !baseBranch || !compareBranch) {
      setState({ status: "missing-selection" });
      return;
    }

    const config = await loadAiApiConfig();
    if (!config) {
      setState({ status: "not-configured" });
      return;
    }

    let diff: BranchDiffDetail;
    try {
      diff = await getBranchDiffDetail(folder, baseBranch, compareBranch);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
      setState({ status: "error", message });
      return;
    }

    const hasChanges = diff.files.some(
      (file) => file.hunks.length > 0 || file.isBinary,
    );
    if (!hasChanges) {
      setState({ status: "no-changes" });
      return;
    }

    setState({ status: "loading", label: "Sending to the model…" });

    try {
      const review = await generateReview(diff, config);
      setState({
        status: "ready",
        diff,
        review,
        base: baseBranch,
        compare: compareBranch,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
      setState({ status: "error", message });
    }
  }, []);

  useEffect(() => {
    runReview();
  }, [runReview]);

  const stats = useMemo(
    () => (state.status === "ready" ? diffLineStats(state.diff) : null),
    [state],
  );

  const groupedFindings = useMemo(() => {
    if (state.status !== "ready") return [];
    const items = buildReviewItems(state.review.findings, state.diff);
    const order = state.diff.files.map((file) => file.path);
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const existing = groups.get(item.file);
      if (existing) existing.push(item);
      else groups.set(item.file, [item]);
    }
    const ordered = order.filter((path) => groups.has(path));
    const leftover = [...groups.keys()].filter((path) => !order.includes(path));
    return [...ordered, ...leftover].map((path) => ({
      file: path,
      items: groups.get(path)!,
    }));
  }, [state]);

  console.log("state :", state);

  if (
    state.status === "loading" ||
    state.status === "missing-selection" ||
    state.status === "not-configured" ||
    state.status === "no-changes" ||
    state.status === "error"
  ) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md space-y-4 px-4 text-center">
          {state.status === "loading" && (
            <>
              <Loader2 className="text-muted-foreground mx-auto size-6 animate-spin" />
              <p className="text-muted-foreground text-sm">{state.label}</p>
            </>
          )}

          {state.status === "missing-selection" && (
            <>
              <h1 className="text-xl font-medium">No branches selected</h1>
              <p className="text-muted-foreground text-sm">
                Choose two branches to compare first.
              </p>
              <Button onClick={() => navigate({ to: "/branch" })}>
                Choose branches
              </Button>
            </>
          )}

          {state.status === "not-configured" && (
            <>
              <h1 className="text-xl font-medium">AI provider not connected</h1>
              <p className="text-muted-foreground text-sm">
                Connect an AI provider to generate reviews.
              </p>
              <Button onClick={() => navigate({ to: "/settings" })}>
                Go to Settings
              </Button>
            </>
          )}

          {state.status === "no-changes" && (
            <>
              <h1 className="text-xl font-medium">No changes to review</h1>
              <p className="text-muted-foreground text-sm">
                These branches don&apos;t differ from one another.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/branch" })}
              >
                Back to Compare Branches
              </Button>
            </>
          )}

          {state.status === "error" && (
            <>
              <h1 className="text-xl font-medium">Review failed</h1>
              <p className="text-destructive text-sm">{state.message}</p>
              <Button onClick={() => runReview()}>Retry</Button>
            </>
          )}
        </div>
      </div>
    );
  }

  const { review, base, compare } = state;
  const overall = review.metrics.overall;

  return (
    <div className="relative flex-1 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, delay: 0.2, ease: "easeOut" }}
        className="fixed right-6 bottom-6 z-10"
      >
        <Button
          size="lg"
          className="gap-2 rounded-full px-4 shadow-lg"
          onClick={() => navigate({ to: "/pr-description" })}
        >
          <GitPullRequest className="size-4" />
          Generate PR
        </Button>
      </motion.div>

      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-10">
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="border-border bg-card space-y-4 rounded-3xl border p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2 font-mono text-sm">
              <GitCompare className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate">{compare}</span>
              <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate">{base}</span>
            </div>
            {stats && (
              <div className="flex items-center gap-3 font-mono text-sm">
                <span className="text-emerald-600 dark:text-emerald-400">
                  +{stats.insertions}
                </span>
                <span className="text-rose-600 dark:text-rose-400">
                  -{stats.deletions}
                </span>
                <span className="text-muted-foreground">
                  {stats.filesChanged} file
                  {stats.filesChanged === 1 ? "" : "s"}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-end justify-between gap-4 border-t border-border/70 pt-4">
            <div>
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                Overall score
              </p>
              <CountUpNumber
                value={overall.score}
                className={`font-mono text-5xl font-semibold ${scoreColorClass(overall.score)}`}
              />
            </div>
            <p className="text-muted-foreground max-w-sm text-right text-sm">
              {review.summary}
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {METRICS.map((metric, index) => {
            const value = review.metrics[metric.key];
            return (
              <motion.div
                key={metric.key}
                custom={index + 1}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className="border-border bg-card space-y-2 rounded-3xl border p-5 shadow-sm"
              >
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  {metric.label}
                </p>
                <p
                  className={`font-mono text-3xl font-semibold ${scoreColorClass(value.score)}`}
                >
                  {value.score}
                </p>
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {value.summary}
                </p>
              </motion.div>
            );
          })}
        </div>

        <div className="space-y-5">
          {groupedFindings.length === 0 && (
            <p className="text-muted-foreground text-center text-sm">
              No specific issues flagged.
            </p>
          )}

          {groupedFindings.map((group, groupIndex) => (
            <div key={group.file} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-sm font-medium">
                  {group.file}
                </span>
                <span className="text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5 text-xs">
                  {group.items.length} finding
                  {group.items.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="space-y-3">
                {group.items.map((item, itemIndex) => {
                  const meta = SEVERITY_META[item.severity];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={itemIndex}
                      className={`bg-card animate-in fade-in slide-in-from-left-2 fill-mode-both overflow-hidden rounded-3xl border-l-4 shadow-sm duration-300 ${meta.borderClassName}`}
                      style={{
                        animationDelay: `${Math.min((groupIndex * 3 + itemIndex) * 40, 480)}ms`,
                      }}
                    >
                      {item.snippet && (
                        <DiffSnippet
                          header={item.snippet.header}
                          content={item.snippet.content}
                        />
                      )}
                      <div
                        className={`flex items-start gap-2.5 p-4 ${item.snippet ? "border-border/70 border-t" : ""}`}
                      >
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full ${meta.avatarClassName}`}
                        >
                          <Bot className="size-4" />
                        </span>
                        <div
                          className={`min-w-0 flex-1 space-y-1 rounded-2xl rounded-tl-sm bg-muted/40 px-3 py-2`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-foreground text-sm font-medium">
                              {item.title}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${meta.badgeClassName}`}
                            >
                              <Icon className="size-3" />
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {item.review}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ReviewScreen;

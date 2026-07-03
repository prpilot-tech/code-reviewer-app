import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  generatePrMetadata,
  loadAiApiConfig,
  type PrMetadata,
} from "@/lib/ai";
import { getBranchDiffDetail, getRepoInfo, type BranchDiffDetail } from "@/lib/git";
import { buildComparePrUrl, parseGithubRemote } from "@/lib/github";
import { getStoreValue } from "@/lib/store";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, ExternalLink, GitCompare, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
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
      folder: string;
      base: string;
      compare: string;
      diff: BranchDiffDetail;
    };

function PrDescriptionScreen() {
  const navigate = useNavigate();
  const [state, setState] = useState<ScreenState>({
    status: "loading",
    label: "Reading the diff…",
  });
  const [meta, setMeta] = useState<PrMetadata | null>(null);
  const [creating, setCreating] = useState(false);

  const run = useCallback(async (isCancelled: () => boolean = () => false) => {
    setState({ status: "loading", label: "Reading the diff…" });
    setMeta(null);

    const [folder, baseBranch, compareBranch] = await Promise.all([
      getStoreValue<string>(ACTIVE_FOLDER_KEY),
      getStoreValue<string>(BASE_BRANCH_KEY),
      getStoreValue<string>(COMPARE_BRANCH_KEY),
    ]);
    if (isCancelled()) return;

    if (!folder || !baseBranch || !compareBranch) {
      setState({ status: "missing-selection" });
      return;
    }

    const config = await loadAiApiConfig();
    if (isCancelled()) return;
    if (!config) {
      setState({ status: "not-configured" });
      return;
    }

    let diff: BranchDiffDetail;
    try {
      diff = await getBranchDiffDetail(folder, baseBranch, compareBranch);
    } catch (err) {
      if (isCancelled()) return;
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
      setState({ status: "error", message });
      return;
    }
    if (isCancelled()) return;

    const hasChanges = diff.files.some(
      (file) => file.hunks.length > 0 || file.isBinary,
    );
    if (!hasChanges) {
      setState({ status: "no-changes" });
      return;
    }

    setState({ status: "loading", label: "Writing the PR title & description…" });

    try {
      const generated = await generatePrMetadata(diff, config);
      if (isCancelled()) return;
      setMeta(generated);
      setState({
        status: "ready",
        folder,
        base: baseBranch,
        compare: compareBranch,
        diff,
      });
    } catch (err) {
      if (isCancelled()) return;
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
      setState({ status: "error", message });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    run(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [run]);

  const handleCreatePr = async () => {
    if (state.status !== "ready" || !meta) return;

    setCreating(true);
    try {
      const repoInfo = await getRepoInfo(state.folder);
      const ref = parseGithubRemote(repoInfo.remoteUrl);
      if (!ref) {
        toast.error(
          "This repo's remote isn't a GitHub URL, so a PR can't be opened automatically.",
        );
        return;
      }

      const url = buildComparePrUrl(
        ref,
        state.base,
        state.compare,
        meta.title,
        meta.description,
      );
      await openUrl(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

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
                Connect an AI provider to generate a PR description.
              </p>
              <Button onClick={() => navigate({ to: "/settings" })}>
                Go to Settings
              </Button>
            </>
          )}

          {state.status === "no-changes" && (
            <>
              <h1 className="text-xl font-medium">No changes to describe</h1>
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
              <h1 className="text-xl font-medium">Generation failed</h1>
              <p className="text-destructive text-sm">{state.message}</p>
              <Button onClick={() => run()}>Retry</Button>
            </>
          )}
        </div>
      </div>
    );
  }

  const { base, compare } = state;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="space-y-1 text-center"
        >
          <h1 className="text-2xl font-medium">PR Title &amp; Description</h1>
          <div className="text-muted-foreground flex items-center justify-center gap-2 font-mono text-sm">
            <span className="truncate">{compare}</span>
            <ArrowRight className="size-3.5 shrink-0" />
            <span className="truncate">{base}</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.06, ease: "easeOut" }}
          className="border-border bg-card space-y-4 rounded-3xl border p-5 shadow-sm"
        >
          <div className="space-y-1.5">
            <Label htmlFor="pr-title">Title</Label>
            <Input
              id="pr-title"
              value={meta?.title ?? ""}
              onChange={(e) =>
                setMeta((prev) =>
                  prev ? { ...prev, title: e.target.value } : prev,
                )
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pr-description">Description</Label>
            <Textarea
              id="pr-description"
              className="min-h-48"
              value={meta?.description ?? ""}
              onChange={(e) =>
                setMeta((prev) =>
                  prev ? { ...prev, description: e.target.value } : prev,
                )
              }
            />
          </div>

          <Button
            className="w-full gap-2"
            disabled={!meta || creating}
            onClick={handleCreatePr}
          >
            {creating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ExternalLink className="size-4" />
            )}
            Create PR on GitHub
          </Button>
          <p className="text-muted-foreground text-center text-xs">
            Opens GitHub&apos;s new PR form prefilled with this title and
            description. Make sure <span className="font-mono">{compare}</span>{" "}
            is pushed to the remote first.
          </p>
        </motion.div>

        <div className="flex justify-center">
          <Button variant="outline" onClick={() => navigate({ to: "/review" })}>
            <GitCompare data-icon="inline-start" />
            Back to Review
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PrDescriptionScreen;

import { Button } from "@/components/ui/button";
import { FolderGit2Icon } from "@/components/ui/folder-git-2";
import { isGitRepo } from "@/lib/git";
import { getStoreValue, setStoreValue } from "@/lib/store";
import { useNavigate } from "@tanstack/react-router";
import { open } from "@tauri-apps/plugin-dialog";
import { Clock, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const ACTIVE_FOLDER_KEY = "activeFolder";
const RECENT_FOLDERS_KEY = "recentFolders";
const MAX_RECENT_FOLDERS = 4;

function folderName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function FolderScreen() {
  const navigate = useNavigate();
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [recentFolders, setRecentFolders] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [savedActive, savedRecent] = await Promise.all([
        getStoreValue<string>(ACTIVE_FOLDER_KEY),
        getStoreValue<string[]>(RECENT_FOLDERS_KEY),
      ]);
      setActiveFolder(savedActive ?? null);
      setRecentFolders(savedRecent ?? []);
      setReady(true);
    })();
  }, []);

  const commitFolder = async (path: string) => {
    const valid = await isGitRepo(path);
    if (!valid) {
      toast.error("Selected folder is not a git repository");
      return;
    }

    const nextRecent = [path, ...recentFolders.filter((p) => p !== path)].slice(
      0,
      MAX_RECENT_FOLDERS,
    );

    setActiveFolder(path);
    setRecentFolders(nextRecent);
    await Promise.all([
      setStoreValue(ACTIVE_FOLDER_KEY, path),
      setStoreValue(RECENT_FOLDERS_KEY, nextRecent),
    ]);
    navigate({ to: "/branch" });
  };

  const handleChooseFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      await commitFolder(selected);
    }
  };

  const handleSelectRecent = (path: string) => commitFolder(path);

  const handleRemoveRecent = async (event: React.MouseEvent, path: string) => {
    event.stopPropagation();
    const nextRecent = recentFolders.filter((p) => p !== path);
    setRecentFolders(nextRecent);
    await setStoreValue(RECENT_FOLDERS_KEY, nextRecent);

    if (activeFolder === path) {
      setActiveFolder(null);
      await setStoreValue(ACTIVE_FOLDER_KEY, null);
    }
  };

  if (!ready) return null;

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-medium">Select Folder</h1>
          <p className="text-muted-foreground text-sm">
            Choose the repository folder you want to work with.
          </p>
        </div>

        <div className="space-y-3 rounded-3xl border border-white/20 bg-white/10 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-white/20 px-3 py-3 text-sm">
            <FolderGit2Icon size={20} />
            <span className="text-muted-foreground">
              No folder selected yet
            </span>
          </div>
          <Button className="w-full" onClick={handleChooseFolder}>
            <FolderGit2Icon data-icon="inline-start" />
            Choose Folder…
          </Button>
        </div>

        {recentFolders.length > 0 && (
          <div className="space-y-2">
            <div className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs font-medium tracking-wide uppercase">
              <Clock className="size-3.5" />
              Recent
            </div>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {recentFolders.map((path) => (
                  <motion.div
                    key={path}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    onClick={() => handleSelectRecent(path)}
                    className={`group flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 backdrop-blur-md transition-colors ${
                      path === activeFolder
                        ? "border-primary/40 bg-primary/10"
                        : "border-white/15 bg-white/10 hover:bg-white/20 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    }`}
                  >
                    <FolderGit2Icon size={20} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {folderName(path)}
                      </div>
                      <div
                        className="text-muted-foreground truncate font-mono text-xs"
                        title={path}
                      >
                        {path}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={(e) => handleRemoveRecent(e, path)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FolderScreen;

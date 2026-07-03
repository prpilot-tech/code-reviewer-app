import FloatingBlobs from "@/components/floating-blobs";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { CogIcon } from "@/components/ui/cog";
import { getStoreValue } from "@/lib/store";
import {
  Outlet,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plane } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

function RootScreen() {
  const navigate = useNavigate();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  useEffect(() => {
    getStoreValue<string>("name").then((value) => setName(value ?? null));
  }, [pathname]);

  const history = router.history;
  const historyIndex = history.location.state.__TSR_index ?? 0;
  const canGoBack = history.canGoBack();
  const canGoForward = historyIndex < history.length - 1;

  return (
    <div className="relative flex min-h-screen flex-col p-4">
      <FloatingBlobs />
      <header className="relative z-10 flex items-center justify-between ">
        <ButtonGroup className="justify-self-start">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!canGoBack}
            onClick={() => history.back()}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!canGoForward}
            onClick={() => history.forward()}
          >
            <ChevronRight />
          </Button>
        </ButtonGroup>
        <Button variant={"ghost"} onClick={() => navigate({ to: "/folder" })}>
          <Plane className="size-4" /> PR Pilot
        </Button>
        <div className="flex items-center justify-self-end gap-2">
          {name && <span className=" text-sm">{name}</span>}
          <AnimatedThemeToggler />
          <Button
            variant="ghost"
            className="size-5 rounded-full p-0"
            aria-label="Settings"
            onClick={() => navigate({ to: "/settings" })}
          >
            <CogIcon />
          </Button>
        </div>
      </header>
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-1 flex-col"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default RootScreen;

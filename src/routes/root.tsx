import FloatingBlobs from "@/components/floating-blobs";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { CogIcon } from "@/components/ui/cog";
import { getStoreValue } from "@/lib/store";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plane } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { STEPS } from "./steps";

function RootScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const currentIndex = STEPS.indexOf(pathname as (typeof STEPS)[number]);

  useEffect(() => {
    getStoreValue<string>("name").then((value) => setName(value ?? null));
  }, [pathname]);

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex >= 0 && currentIndex < STEPS.length - 1;

  return (
    <div className="relative flex min-h-screen flex-col p-4">
      <FloatingBlobs />
      <header className="relative z-10 flex items-center justify-between ">
        <ButtonGroup className="justify-self-start">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!canGoBack}
            onClick={() => navigate({ to: STEPS[currentIndex - 1] })}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!canGoForward}
            onClick={() => navigate({ to: STEPS[currentIndex + 1] })}
          >
            <ChevronRight />
          </Button>
        </ButtonGroup>
        <span className=" flex gap-1 justify-self-center text-sm font-medium">
          <Plane className="size-4" /> PR Pilot
        </span>
        <div className="flex items-center justify-self-end gap-2">
          {name && <span className=" text-sm">{name}</span>}
          <AnimatedThemeToggler />
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Settings"
            onClick={() => navigate({ to: "/settings" })}
          >
            <CogIcon size={18} />
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

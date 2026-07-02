import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import RootScreen from "./routes/root";
import NameScreen from "./routes/name";
import FolderScreen from "./routes/folder";
import BranchScreen from "./routes/branch";
import ReviewScreen from "./routes/review";
import PrDescriptionScreen from "./routes/pr-description";
import SettingsScreen from "./routes/settings";
import { getStoreValue } from "./lib/store";

const rootRoute = createRootRoute({ component: RootScreen });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async () => {
    const savedName = await getStoreValue<string>("name");
    throw redirect({ to: savedName ? "/folder" : "/name" });
  },
});

const nameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/name",
  beforeLoad: async () => {
    const savedName = await getStoreValue<string>("name");
    if (savedName) throw redirect({ to: "/folder" });
  },
  component: NameScreen,
});

const folderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/folder",
  component: FolderScreen,
});

const branchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/branch",
  component: BranchScreen,
});

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/review",
  component: ReviewScreen,
});

const prDescriptionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pr-description",
  component: PrDescriptionScreen,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsScreen,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  nameRoute,
  folderRoute,
  branchRoute,
  reviewRoute,
  prDescriptionRoute,
  settingsRoute,
]);

const memoryHistory = createMemoryHistory({ initialEntries: ["/"] });

export const router = createRouter({ routeTree, history: memoryHistory });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AppErrorFallback, NotFoundPage } from "./components/ErrorStates";

// Singleton QueryClient for server-side rendering (shared across requests)
// Client-side gets a new instance per app mount
let serverQueryClient: QueryClient | undefined;

export const getRouter = () => {
  const queryClient = typeof window === 'undefined'
    ? (serverQueryClient ??= new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 300_000,
          },
        },
      }))
    : new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 300_000,
          },
        },
      });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: AppErrorFallback,
    defaultNotFoundComponent: NotFoundPage,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

import { cacheLife, cacheTag } from "next/cache";
import {
  defaultShouldDehydrateQuery,
  QueryClient,
  type DehydratedState,
  type QueryKey,
} from "@tanstack/react-query";

export type HydratedQuery = {
  queryKey: QueryKey;
  data: unknown;
};

export type HydrationOptions = {
  tags?: string[];
};

/**
 * Caches the hydration timestamp using Next.js 16 `"use cache"`.
 * This prevents the unstable `Date.now()` prerendering error when prerendering with Cache Components.
 */
async function getHydrationUpdatedAt(tags?: string[]) {
  "use cache";
  if (tags && tags.length > 0) {
    cacheTag(...tags);
  }
  cacheLife("max");
  return Date.now();
}

/**
 * Prerenderable dehydration helper for Next.js 16 Cache Components.
 * Generates deterministic dehydrated TanStack Query state during SSR / SSG.
 */
export async function dehydrate(
  queries: HydratedQuery[],
  options?: HydrationOptions
): Promise<DehydratedState> {
  const updatedAt = await getHydrationUpdatedAt(options?.tags);

  const queryClient = new QueryClient();

  for (const query of queries) {
    if (query.data !== undefined) {
      queryClient.setQueryData(query.queryKey, query.data, { updatedAt });
    }
  }

  return {
    mutations: [],
    queries: queryClient
      .getQueryCache()
      .getAll()
      .filter((query) => defaultShouldDehydrateQuery(query))
      .map((query) => ({
        dehydratedAt: updatedAt,
        queryHash: query.queryHash,
        queryKey: query.queryKey,
        state: query.state,
        ...(query.meta ? { meta: query.meta } : {}),
      })),
  };
}

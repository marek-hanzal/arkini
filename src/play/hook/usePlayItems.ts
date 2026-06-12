import { useQuery } from "@tanstack/react-query";
import { loadPlayBackend } from "./loadPlayBackend";
import { playQueryKeys } from "./playQueryKeys";

export function usePlayItems() {
  return useQuery({
    queryKey: playQueryKeys.items,
    enabled: typeof window !== "undefined",
    async queryFn() {
      const db = await loadPlayBackend();
      return db.readItemCatalogView();
    },
    staleTime: Infinity,
  });
}

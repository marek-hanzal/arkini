import { useQuery } from "@tanstack/react-query";
import { loadPlayBackend } from "./loadPlayBackend";
import { playQueryKeys } from "./playQueryKeys";

export function usePlayInventory() {
  return useQuery({
    queryKey: playQueryKeys.inventory,
    enabled: typeof window !== "undefined",
    async queryFn() {
      const db = await loadPlayBackend();
      return db.readInventoryView();
    },
  });
}

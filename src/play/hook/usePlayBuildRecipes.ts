import { useQuery } from "@tanstack/react-query";
import { loadPlayBackend } from "./loadPlayBackend";
import { playQueryKeys } from "./playQueryKeys";

export function usePlayBuildRecipes() {
  return useQuery({
    queryKey: playQueryKeys.buildRecipes,
    enabled: typeof window !== "undefined",
    async queryFn() {
      const db = await loadPlayBackend();
      return db.readBuildRecipeViews();
    },
  });
}

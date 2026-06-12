import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GameView } from "~/play/logic/playTypes";

export const playQueryKey = ["arkini", "game"] as const;
export const databaseStatusQueryKey = ["arkini", "database", "status"] as const;

async function loadDb() {
  const db = await import("~/play/logic/playBackend");
  await db.bootstrapDatabase();
  return db;
}

export function usePlayView<TData = GameView>(select?: (game: GameView) => TData) {
  return useQuery({
    queryKey: playQueryKey,
    enabled: typeof window !== "undefined",
    async queryFn() {
      const db = await loadDb();
      return db.readGameView();
    },
    select,
  });
}

export namespace usePlayView {
  export type Select<TData> = (game: GameView) => TData;
}

export function usePlayDataInvalidation() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: playQueryKey }),
      queryClient.invalidateQueries({ queryKey: databaseStatusQueryKey }),
    ]);
  }, [queryClient]);
}

export function usePlayAction<TVariables, TResult = void>(
  action: (db: typeof import("~/play/logic/playBackend"), variables: TVariables) => Promise<TResult>,
  options: usePlayAction.Options = {},
) {
  const invalidatePlayData = usePlayDataInvalidation();

  return useMutation({
    async mutationFn(variables: TVariables) {
      const db = await loadDb();
      return action(db, variables);
    },
    async onSuccess() {
      if (options.invalidateOnSuccess === false) return;
      await invalidatePlayData();
    },
  });
}

export namespace usePlayAction {
  export interface Options {
    invalidateOnSuccess?: boolean;
  }
}

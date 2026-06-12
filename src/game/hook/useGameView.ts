import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GameView } from "~/database/server";

export const gameQueryKey = ["arkini", "game"] as const;
export const databaseStatusQueryKey = ["arkini", "database", "status"] as const;

async function loadDb() {
  const db = await import("~/database/server");
  await db.bootstrapDatabase();
  return db;
}

export function useGameView<TData = GameView>(select?: (game: GameView) => TData) {
  return useQuery({
    queryKey: gameQueryKey,
    enabled: typeof window !== "undefined",
    async queryFn() {
      const db = await loadDb();
      return db.readGameView();
    },
    select,
  });
}

export namespace useGameView {
  export type Select<TData> = (game: GameView) => TData;
}

export function useGameDataInvalidation() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: gameQueryKey }),
      queryClient.invalidateQueries({ queryKey: databaseStatusQueryKey }),
    ]);
  }, [queryClient]);
}

export function useGameAction<TVariables, TResult = void>(
  action: (db: typeof import("~/database/server"), variables: TVariables) => Promise<TResult>,
  options: useGameAction.Options = {},
) {
  const invalidateGameData = useGameDataInvalidation();

  return useMutation({
    async mutationFn(variables: TVariables) {
      const db = await loadDb();
      return action(db, variables);
    },
    async onSuccess() {
      if (options.invalidateOnSuccess === false) return;
      await invalidateGameData();
    },
  });
}

export namespace useGameAction {
  export interface Options {
    invalidateOnSuccess?: boolean;
  }
}

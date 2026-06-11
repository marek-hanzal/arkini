import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const gameQueryKey = ["arkini", "game"] as const;

async function loadDb() {
  const db = await import("@arkini/db");
  await db.bootstrapDatabase();
  return db;
}

export function useGameView() {
  return useQuery({
    queryKey: gameQueryKey,
    enabled: typeof window !== "undefined",
    async queryFn() {
      const db = await loadDb();
      return db.readGameView();
    },
  });
}

export function useGameAction<TVariables>(action: (db: typeof import("@arkini/db"), variables: TVariables) => Promise<void>) {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(variables: TVariables) {
      const db = await loadDb();
      await action(db, variables);
    },
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: gameQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["arkini", "database", "status"] }),
      ]);
    },
  });
}

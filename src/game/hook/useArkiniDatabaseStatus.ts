import { useQuery } from "@tanstack/react-query";

export function useArkiniDatabaseStatus() {
  return useQuery({
    queryKey: ["arkini", "database", "status"],
    enabled: typeof window !== "undefined",
    async queryFn() {
      const db = await import("~/game/server/gameServer");

      await db.bootstrapDatabase();

      return db.readDatabaseStatus();
    },
  });
}

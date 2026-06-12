import { useQuery } from "@tanstack/react-query";
import { loadPlayBackend } from "./loadPlayBackend";
import { databaseStatusQueryKey } from "./databaseStatusQueryKey";

export function useArkiniDatabaseStatus() {
	return useQuery({
		queryKey: databaseStatusQueryKey,
		enabled: typeof window !== "undefined",
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readDatabaseStatus();
		},
	});
}

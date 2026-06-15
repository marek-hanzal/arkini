import { useSuspenseQuery } from "@tanstack/react-query";
import type { DatabaseStatus } from "~/play/logic/DatabaseStatus";
import { databaseStatusQueryKey } from "./databaseStatusQueryKey";
import { loadPlayBackend } from "./loadPlayBackend";

export function useArkiniDatabaseStatus(): DatabaseStatus {
	return useSuspenseQuery({
		queryKey: databaseStatusQueryKey,
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readDatabaseStatus();
		},
	}).data;
}

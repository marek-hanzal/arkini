import type { QueryClient } from "@tanstack/react-query";
import { loadPlayBackend } from "~/v0/query/loadPlayBackend";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export namespace syncDatabaseStatusView {
	export interface Props {
		queryClient: QueryClient;
	}
}

export const syncDatabaseStatusView = async ({ queryClient }: syncDatabaseStatusView.Props) => {
	const db = await loadPlayBackend();
	queryClient.setQueryData(playQueryKeys.databaseStatus, await db.readDatabaseStatus());
};

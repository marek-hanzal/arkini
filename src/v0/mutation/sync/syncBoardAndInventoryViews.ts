import type { QueryClient } from "@tanstack/react-query";
import { syncBoardView } from "~/v0/mutation/sync/syncBoardView";
import { syncDatabaseStatusView } from "~/v0/mutation/sync/syncDatabaseStatusView";
import { syncInventoryView } from "~/v0/mutation/sync/syncInventoryView";

export namespace syncBoardAndInventoryViews {
	export interface Props {
		queryClient: QueryClient;
	}
}

export const syncBoardAndInventoryViews = async ({
	queryClient,
}: syncBoardAndInventoryViews.Props) => {
	await Promise.all([
		syncBoardView({
			queryClient,
		}),
		syncInventoryView({
			queryClient,
		}),
		syncDatabaseStatusView({
			queryClient,
		}),
	]);
};

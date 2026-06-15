import type { QueryClient } from "@tanstack/react-query";
import { loadPlayBackend } from "~/v0/query/loadPlayBackend";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export namespace syncUpgradeListView {
	export interface Props {
		queryClient: QueryClient;
	}
}

export const syncUpgradeListView = async ({ queryClient }: syncUpgradeListView.Props) => {
	const db = await loadPlayBackend();
	queryClient.setQueryData(playQueryKeys.upgrades, await db.readUpgradeListView());
};

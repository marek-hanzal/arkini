import type { QueryClient } from "@tanstack/react-query";
import { syncBoardAndInventoryViews } from "~/v0/mutation/sync/syncBoardAndInventoryViews";
import { syncUpgradeListView } from "~/v0/mutation/sync/syncUpgradeListView";

export namespace syncUpgradePurchaseViews {
	export interface Props {
		queryClient: QueryClient;
	}
}

export const syncUpgradePurchaseViews = async ({ queryClient }: syncUpgradePurchaseViews.Props) => {
	await Promise.all([
		syncBoardAndInventoryViews({
			queryClient,
		}),
		syncUpgradeListView({
			queryClient,
		}),
	]);
};

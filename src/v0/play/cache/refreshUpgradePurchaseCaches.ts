import type { QueryClient } from "@tanstack/react-query";
import { refreshBoardAndInventoryCaches } from "~/v0/play/cache/refreshBoardAndInventoryCaches";
import { refreshUpgradeListCache } from "~/v0/upgrade/cache/refreshUpgradeListCache";

export namespace refreshUpgradePurchaseCaches {
	export interface Props {
		queryClient: QueryClient;
	}
}

export const refreshUpgradePurchaseCaches = async ({
	queryClient,
}: refreshUpgradePurchaseCaches.Props) => {
	await Promise.all([
		refreshBoardAndInventoryCaches({
			queryClient,
		}),
		refreshUpgradeListCache({
			queryClient,
		}),
	]);
};

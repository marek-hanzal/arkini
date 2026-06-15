import { useSuspenseQuery } from "@tanstack/react-query";
import type { UpgradeListView } from "~/upgrade/view/UpgradeListViewSchema";
import { loadPlayBackend } from "./loadPlayBackend";
import { playQueryKeys } from "./playQueryKeys";

export function usePlayUpgrades(): UpgradeListView {
	return useSuspenseQuery({
		queryKey: playQueryKeys.upgrades,
		refetchInterval(query) {
			return query.state.data?.upgrades.some((upgrade) => upgrade.inProgress) ? 500 : false;
		},
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readUpgradeListView();
		},
	}).data;
}

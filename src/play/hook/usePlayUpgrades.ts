import { useQuery } from "@tanstack/react-query";
import { loadPlayBackend } from "./loadPlayBackend";
import { playQueryKeys } from "./playQueryKeys";

export function usePlayUpgrades() {
	return useQuery({
		queryKey: playQueryKeys.upgrades,
		enabled: typeof window !== "undefined",
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readUpgradeListView();
		},
	});
}

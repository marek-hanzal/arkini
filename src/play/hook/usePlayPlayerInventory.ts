import { useQuery } from "@tanstack/react-query";
import { loadPlayBackend } from "./loadPlayBackend";
import { playQueryKeys } from "./playQueryKeys";

export function usePlayPlayerInventory() {
	return useQuery({
		queryKey: playQueryKeys.playerInventory,
		enabled: typeof window !== "undefined",
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readPlayerInventoryView();
		},
	});
}

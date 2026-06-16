import type { QueryClient } from "@tanstack/react-query";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { boardQueryKeys } from "~/v0/board/query/boardQueryKeys";
import { removeBoardTransientTilesByGroup } from "~/v0/board/animation/BoardTransientTileStore";
import { inventoryQueryKeys } from "~/v0/inventory/query/inventoryQueryKeys";
import { clearTileEngineMotionRequestsByGroup } from "~/v0/tile-engine";

export namespace restoreCacheSnapshot {
	export interface Props {
		queryClient: QueryClient;
		snapshot?: CacheSnapshot.Type;
	}
}

export const restoreCacheSnapshot = ({ queryClient, snapshot }: restoreCacheSnapshot.Props) => {
	for (const groupId of snapshot?.boardTransientMergeGroupIds ?? []) {
		removeBoardTransientTilesByGroup(groupId);
		clearTileEngineMotionRequestsByGroup({
			engineId: "board",
			groupId,
		});
	}
	if (snapshot?.board) queryClient.setQueryData(boardQueryKeys.view, snapshot.board);
	if (snapshot?.inventory) queryClient.setQueryData(inventoryQueryKeys.view, snapshot.inventory);
};

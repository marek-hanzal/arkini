import type { QueryClient } from "@tanstack/react-query";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export namespace restoreCacheSnapshot {
	export interface Props {
		queryClient: QueryClient;
		snapshot?: CacheSnapshot.Type;
	}
}

export const restoreCacheSnapshot = ({ queryClient, snapshot }: restoreCacheSnapshot.Props) => {
	if (snapshot?.board) queryClient.setQueryData(playQueryKeys.board, snapshot.board);
	if (snapshot?.inventory) queryClient.setQueryData(playQueryKeys.inventory, snapshot.inventory);
};

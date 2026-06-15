import type { QueryClient } from "@tanstack/react-query";
import type { OptimisticSnapshot } from "~/v0/mutation/OptimisticSnapshot";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export namespace rollbackOptimisticSnapshot {
	export interface Props {
		queryClient: QueryClient;
		snapshot?: OptimisticSnapshot;
	}
}

export const rollbackOptimisticSnapshot = ({
	queryClient,
	snapshot,
}: rollbackOptimisticSnapshot.Props) => {
	if (snapshot?.board) queryClient.setQueryData(playQueryKeys.board, snapshot.board);
	if (snapshot?.inventory) queryClient.setQueryData(playQueryKeys.inventory, snapshot.inventory);
};

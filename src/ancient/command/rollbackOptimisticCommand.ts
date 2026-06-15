import type { QueryClient } from "@tanstack/react-query";
import { playQueryKeys } from "~/play/hook/playQueryKeys";
import type { applyOptimisticCommand } from "./applyOptimisticCommand";

export namespace rollbackOptimisticCommand {
	export interface Props {
		queryClient: QueryClient;
		snapshot?: applyOptimisticCommand.Snapshot;
	}
}

export const rollbackOptimisticCommand = ({
	queryClient,
	snapshot,
}: rollbackOptimisticCommand.Props) => {
	if (snapshot?.board) {
		queryClient.setQueryData(playQueryKeys.board, snapshot.board);
	}
	if (snapshot?.inventory) {
		queryClient.setQueryData(playQueryKeys.inventory, snapshot.inventory);
	}
};

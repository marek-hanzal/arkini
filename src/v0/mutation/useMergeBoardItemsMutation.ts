import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mergeFx } from "~/board/fx/mergeFx";
import type { MutationResult } from "~/v0/mutation/MutationResult";
import type { OptimisticSnapshot } from "~/v0/mutation/OptimisticSnapshot";
import { runGameFx } from "~/v0/mutation/effect/runGameFx";
import { applyBoardMergeOptimisticPatch } from "~/v0/mutation/optimistic/applyBoardMergeOptimisticPatch";
import { rollbackOptimisticSnapshot } from "~/v0/mutation/optimistic/rollbackOptimisticSnapshot";
import { syncBoardAndInventoryViews } from "~/v0/mutation/sync/syncBoardAndInventoryViews";

export const useMergeBoardItemsMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<MutationResult, Error, mergeFx.Props, OptimisticSnapshot>({
		mutationFn(input) {
			return runGameFx({
				effect: mergeFx(input),
			});
		},
		onMutate(input) {
			return applyBoardMergeOptimisticPatch({
				queryClient,
				input,
			});
		},
		onError(_error, _input, snapshot) {
			rollbackOptimisticSnapshot({
				queryClient,
				snapshot,
			});
		},
		async onSuccess() {
			await syncBoardAndInventoryViews({
				queryClient,
			});
		},
	});
};

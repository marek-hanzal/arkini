import { useMutation, useQueryClient } from "@tanstack/react-query";
import { stashFx } from "~/inventory/fx/stashFx";
import type { MutationResult } from "~/v0/mutation/MutationResult";
import type { OptimisticSnapshot } from "~/v0/mutation/OptimisticSnapshot";
import { runGameFx } from "~/v0/mutation/effect/runGameFx";
import { applyInventoryStashOptimisticPatch } from "~/v0/mutation/optimistic/applyInventoryStashOptimisticPatch";
import { rollbackOptimisticSnapshot } from "~/v0/mutation/optimistic/rollbackOptimisticSnapshot";
import { syncBoardAndInventoryViews } from "~/v0/mutation/sync/syncBoardAndInventoryViews";

export const useStashBoardItemMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<MutationResult, Error, stashFx.Props, OptimisticSnapshot>({
		mutationFn(input) {
			return runGameFx({
				effect: stashFx(input),
			});
		},
		onMutate(input) {
			return applyInventoryStashOptimisticPatch({
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

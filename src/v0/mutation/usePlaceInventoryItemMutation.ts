import { useMutation, useQueryClient } from "@tanstack/react-query";
import { placeFx } from "~/inventory/fx/placeFx";
import type { MutationResult } from "~/v0/mutation/MutationResult";
import type { OptimisticSnapshot } from "~/v0/mutation/OptimisticSnapshot";
import { runGameFx } from "~/v0/mutation/effect/runGameFx";
import { applyInventoryPlaceOptimisticPatch } from "~/v0/mutation/optimistic/applyInventoryPlaceOptimisticPatch";
import { rollbackOptimisticSnapshot } from "~/v0/mutation/optimistic/rollbackOptimisticSnapshot";
import { syncBoardAndInventoryViews } from "~/v0/mutation/sync/syncBoardAndInventoryViews";

export const usePlaceInventoryItemMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<MutationResult, Error, placeFx.Props, OptimisticSnapshot>({
		mutationFn(input) {
			return runGameFx({
				effect: placeFx(input),
			});
		},
		onMutate(input) {
			return applyInventoryPlaceOptimisticPatch({
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

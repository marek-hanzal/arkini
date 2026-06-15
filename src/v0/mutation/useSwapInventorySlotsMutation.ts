import { useMutation, useQueryClient } from "@tanstack/react-query";
import { swapFx } from "~/inventory/fx/swapFx";
import type { MutationResult } from "~/v0/mutation/MutationResult";
import type { OptimisticSnapshot } from "~/v0/mutation/OptimisticSnapshot";
import { runGameFx } from "~/v0/mutation/effect/runGameFx";
import { applyInventorySwapOptimisticPatch } from "~/v0/mutation/optimistic/applyInventorySwapOptimisticPatch";
import { rollbackOptimisticSnapshot } from "~/v0/mutation/optimistic/rollbackOptimisticSnapshot";
import { syncDatabaseStatusView } from "~/v0/mutation/sync/syncDatabaseStatusView";
import { syncInventoryView } from "~/v0/mutation/sync/syncInventoryView";

export const useSwapInventorySlotsMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<MutationResult, Error, swapFx.Props, OptimisticSnapshot>({
		mutationFn(input) {
			return runGameFx({
				effect: swapFx(input),
			});
		},
		onMutate(input) {
			return applyInventorySwapOptimisticPatch({
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
			await Promise.all([
				syncInventoryView({
					queryClient,
				}),
				syncDatabaseStatusView({
					queryClient,
				}),
			]);
		},
	});
};

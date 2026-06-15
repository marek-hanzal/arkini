import { useMutation, useQueryClient } from "@tanstack/react-query";
import { swapFx } from "~/board/fx/swapFx";
import type { MutationResult } from "~/v0/mutation/MutationResult";
import type { OptimisticSnapshot } from "~/v0/mutation/OptimisticSnapshot";
import { runGameFx } from "~/v0/mutation/effect/runGameFx";
import { applyBoardSwapOptimisticPatch } from "~/v0/mutation/optimistic/applyBoardSwapOptimisticPatch";
import { rollbackOptimisticSnapshot } from "~/v0/mutation/optimistic/rollbackOptimisticSnapshot";
import { syncBoardView } from "~/v0/mutation/sync/syncBoardView";
import { syncDatabaseStatusView } from "~/v0/mutation/sync/syncDatabaseStatusView";

export const useSwapBoardItemsMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<MutationResult, Error, swapFx.Props, OptimisticSnapshot>({
		mutationFn(input) {
			return runGameFx({
				effect: swapFx(input),
			});
		},
		onMutate(input) {
			return applyBoardSwapOptimisticPatch({
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
				syncBoardView({
					queryClient,
				}),
				syncDatabaseStatusView({
					queryClient,
				}),
			]);
		},
	});
};

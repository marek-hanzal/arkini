import { useMutation, useQueryClient } from "@tanstack/react-query";
import { moveFx } from "~/board/fx/moveFx";
import type { MutationResult } from "~/v0/mutation/MutationResult";
import type { OptimisticSnapshot } from "~/v0/mutation/OptimisticSnapshot";
import { runGameFx } from "~/v0/mutation/effect/runGameFx";
import { applyBoardMoveOptimisticPatch } from "~/v0/mutation/optimistic/applyBoardMoveOptimisticPatch";
import { rollbackOptimisticSnapshot } from "~/v0/mutation/optimistic/rollbackOptimisticSnapshot";
import { syncBoardView } from "~/v0/mutation/sync/syncBoardView";
import { syncDatabaseStatusView } from "~/v0/mutation/sync/syncDatabaseStatusView";

export const useMoveBoardItemMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<MutationResult, Error, moveFx.Props, OptimisticSnapshot>({
		mutationFn(input) {
			return runGameFx({
				effect: moveFx(input),
			});
		},
		onMutate(input) {
			return applyBoardMoveOptimisticPatch({
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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { withdrawInputFx } from "~/activation/fx/withdrawInputFx";
import type { MutationResult } from "~/v0/mutation/MutationResult";
import { runGameFx } from "~/v0/mutation/effect/runGameFx";
import { syncBoardAndInventoryViews } from "~/v0/mutation/sync/syncBoardAndInventoryViews";

export const useWithdrawActivationInputMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<MutationResult, Error, withdrawInputFx.Props>({
		mutationFn(input) {
			return runGameFx({
				effect: withdrawInputFx(input),
			});
		},
		async onSuccess() {
			await syncBoardAndInventoryViews({
				queryClient,
			});
		},
	});
};

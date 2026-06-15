import { useMutation, useQueryClient } from "@tanstack/react-query";
import { claimCraftFx } from "~/craft/fx/claimCraftFx";
import type { MutationResult } from "~/v0/mutation/MutationResult";
import { runGameFx } from "~/v0/mutation/effect/runGameFx";
import { syncBoardAndInventoryViews } from "~/v0/mutation/sync/syncBoardAndInventoryViews";

export const useClaimCraftMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<MutationResult, Error, claimCraftFx.Props>({
		mutationFn(input) {
			return runGameFx({
				effect: claimCraftFx(input),
			});
		},
		async onSuccess() {
			await syncBoardAndInventoryViews({
				queryClient,
			});
		},
	});
};

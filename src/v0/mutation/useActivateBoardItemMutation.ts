import { useMutation, useQueryClient } from "@tanstack/react-query";
import { activateFx } from "~/activation/fx/activateFx";
import type { MutationResult } from "~/v0/mutation/MutationResult";
import { runGameFx } from "~/v0/mutation/effect/runGameFx";
import { syncBoardAndInventoryViews } from "~/v0/mutation/sync/syncBoardAndInventoryViews";

export const useActivateBoardItemMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<MutationResult, Error, activateFx.Props>({
		mutationFn(input) {
			return runGameFx({
				effect: activateFx(input),
			});
		},
		async onSuccess() {
			await syncBoardAndInventoryViews({
				queryClient,
			});
		},
	});
};

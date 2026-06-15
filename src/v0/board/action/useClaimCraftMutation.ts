import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { claimCraftFx } from "~/v0/craft/fx/claimCraftFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import { runGameFx } from "~/v0/fx/runGameFx";
import { refreshBoardAndInventoryCaches } from "~/v0/play/cache/refreshBoardAndInventoryCaches";

export const useClaimCraftMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, GameActionError, claimCraftFx.Props>({
		mutationFn(input) {
			return runGameFx({
				effect: claimCraftFx(input),
			});
		},
		async onSuccess() {
			await refreshBoardAndInventoryCaches({
				queryClient,
			});
		},
	});
};

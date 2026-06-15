import { useMutation, useQueryClient } from "@tanstack/react-query";
import { activateFx } from "~/activation/fx/activateFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import { runGameFx } from "~/v0/fx/runGameFx";
import { refreshBoardAndInventoryCaches } from "~/v0/play/cache/refreshBoardAndInventoryCaches";

export const useActivateBoardItemMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, unknown, activateFx.Props>({
		mutationFn(input) {
			return runGameFx({
				effect: activateFx(input),
			});
		},
		async onSuccess() {
			await refreshBoardAndInventoryCaches({
				queryClient,
			});
		},
	});
};

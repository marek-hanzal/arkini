import { useMutation, useQueryClient } from "@tanstack/react-query";
import { activateBoardItemFx } from "~/v0/activation/fx/activateBoardItemFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import { runGameFx } from "~/v0/fx/runGameFx";
import { refreshBoardAndInventoryCaches } from "~/v0/play/cache/refreshBoardAndInventoryCaches";

export const useActivateBoardItemMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, unknown, activateBoardItemFx.Props>({
		mutationFn(input) {
			return runGameFx({
				effect: activateBoardItemFx(input),
			});
		},
		async onSuccess() {
			await refreshBoardAndInventoryCaches({
				queryClient,
			});
		},
	});
};

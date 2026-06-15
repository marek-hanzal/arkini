import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { activateBoardItemFx } from "~/v0/activation/fx/activateBoardItemFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyActionResultCachePatch } from "~/v0/play/cache/applyActionResultCachePatch";

export const useActivateBoardItemMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, GameActionError, activateBoardItemFx.Props>({
		mutationFn(input) {
			return runGameFx({
				effect: activateBoardItemFx(input),
			});
		},
		onSuccess(result) {
			applyActionResultCachePatch({
				queryClient,
				result,
			});
		},
	});
};

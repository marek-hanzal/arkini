import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { stashBoardItemFx } from "~/v0/inventory/fx/stashBoardItemFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyInventoryStashCachePatch } from "~/v0/inventory/cache/applyInventoryStashCachePatch";
import { restoreCacheSnapshot } from "~/v0/play/cache/restoreCacheSnapshot";
import { applyActionResultCachePatch } from "~/v0/play/cache/applyActionResultCachePatch";

export const useStashBoardItemMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<
		ActionResult.Type,
		GameActionError,
		stashBoardItemFx.Props,
		CacheSnapshot.Type
	>({
		mutationFn(input) {
			return runGameFx({
				effect: stashBoardItemFx(input),
			});
		},
		onMutate(input) {
			return applyInventoryStashCachePatch({
				queryClient,
				input,
			});
		},
		onError(_error, _input, snapshot) {
			restoreCacheSnapshot({
				queryClient,
				snapshot,
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

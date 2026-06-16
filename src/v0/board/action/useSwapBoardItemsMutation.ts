import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordActionMutation } from "~/v0/debug/recordActionMutation";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { swapBoardItemsFx } from "~/v0/board/fx/swapBoardItemsFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyBoardSwapCachePatch } from "~/v0/board/cache/applyBoardSwapCachePatch";
import { restoreCacheSnapshot } from "~/v0/play/cache/restoreCacheSnapshot";
import { applyActionResultCachePatch } from "~/v0/play/cache/applyActionResultCachePatch";

export const useSwapBoardItemsMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<
		ActionResult.Type,
		GameActionError,
		swapBoardItemsFx.Props,
		CacheSnapshot.Type
	>({
		mutationFn(input) {
			recordActionMutation({
				action: "swapBoardItems",
				phase: "mutate.start",
				detail: input,
			});
			return runGameFx({
				effect: swapBoardItemsFx(input),
			});
		},
		onMutate(input) {
			recordActionMutation({
				action: "swapBoardItems",
				phase: "cache.optimistic.start",
				detail: input,
			});
			return applyBoardSwapCachePatch({
				queryClient,
				input,
			});
		},
		onError(error, _input, snapshot) {
			recordActionMutation({
				action: "swapBoardItems",
				phase: "mutate.error",
				detail: error,
			});
			recordActionMutation({
				action: "swapBoardItems",
				phase: "cache.restore",
			});
			restoreCacheSnapshot({
				queryClient,
				snapshot,
			});
		},
		onSuccess(result) {
			recordActionMutation({
				action: "swapBoardItems",
				phase: "mutate.success",
				detail: result,
			});
			applyActionResultCachePatch({
				queryClient,
				result,
			});
		},
	});
};

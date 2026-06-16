import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordActionMutation } from "~/v0/debug/recordActionMutation";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { moveBoardItemFx } from "~/v0/board/fx/moveBoardItemFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyBoardMoveCachePatch } from "~/v0/board/cache/applyBoardMoveCachePatch";
import { restoreCacheSnapshot } from "~/v0/play/cache/restoreCacheSnapshot";
import { applyActionResultCachePatch } from "~/v0/play/cache/applyActionResultCachePatch";

export const useMoveBoardItemMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<
		ActionResult.Type,
		GameActionError,
		moveBoardItemFx.Props,
		CacheSnapshot.Type
	>({
		mutationFn(input) {
			recordActionMutation({
				action: "moveBoardItem",
				phase: "mutate.start",
				detail: input,
			});
			return runGameFx({
				effect: moveBoardItemFx(input),
			});
		},
		onMutate(input) {
			recordActionMutation({
				action: "moveBoardItem",
				phase: "cache.optimistic.start",
				detail: input,
			});
			return applyBoardMoveCachePatch({
				queryClient,
				input,
			});
		},
		onError(error, _input, snapshot) {
			recordActionMutation({
				action: "moveBoardItem",
				phase: "mutate.error",
				detail: error,
			});
			recordActionMutation({
				action: "moveBoardItem",
				phase: "cache.restore",
			});
			restoreCacheSnapshot({
				queryClient,
				snapshot,
			});
		},
		onSuccess(result) {
			recordActionMutation({
				action: "moveBoardItem",
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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordActionMutation } from "~/v0/debug/recordActionMutation";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { mergeBoardItemsFx } from "~/v0/board/fx/mergeBoardItemsFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyBoardMergeCachePatch } from "~/v0/board/cache/applyBoardMergeCachePatch";
import { restoreCacheSnapshot } from "~/v0/play/cache/restoreCacheSnapshot";
import { applyActionResultCachePatch } from "~/v0/play/cache/applyActionResultCachePatch";

export const useMergeBoardItemsMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<
		ActionResult.Type,
		GameActionError,
		mergeBoardItemsFx.Props,
		CacheSnapshot.Type
	>({
		mutationFn(input) {
			recordActionMutation({
				action: "mergeBoardItems",
				phase: "mutate.start",
				detail: input,
			});
			return runGameFx({
				effect: mergeBoardItemsFx(input),
			});
		},
		onMutate(input) {
			recordActionMutation({
				action: "mergeBoardItems",
				phase: "cache.optimistic.start",
				detail: input,
			});
			return applyBoardMergeCachePatch({
				queryClient,
				input,
			});
		},
		onError(error, _input, snapshot) {
			recordActionMutation({
				action: "mergeBoardItems",
				phase: "mutate.error",
				detail: error,
			});
			recordActionMutation({
				action: "mergeBoardItems",
				phase: "cache.restore",
			});
			restoreCacheSnapshot({
				queryClient,
				snapshot,
			});
		},
		onSuccess(result) {
			recordActionMutation({
				action: "mergeBoardItems",
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

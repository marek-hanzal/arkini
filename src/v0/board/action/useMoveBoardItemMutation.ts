import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { moveBoardItemFx } from "~/v0/board/fx/moveBoardItemFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyBoardMoveCachePatch } from "~/v0/board/cache/applyBoardMoveCachePatch";
import { restoreCacheSnapshot } from "~/v0/play/cache/restoreCacheSnapshot";
import { refreshBoardViewCache } from "~/v0/board/cache/refreshBoardViewCache";
import { refreshDatabaseStatusCache } from "~/v0/database/cache/refreshDatabaseStatusCache";

export const useMoveBoardItemMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<
		ActionResult.Type,
		GameActionError,
		moveBoardItemFx.Props,
		CacheSnapshot.Type
	>({
		mutationFn(input) {
			return runGameFx({
				effect: moveBoardItemFx(input),
			});
		},
		onMutate(input) {
			return applyBoardMoveCachePatch({
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
		async onSuccess() {
			await Promise.all([
				refreshBoardViewCache({
					queryClient,
				}),
				refreshDatabaseStatusCache({
					queryClient,
				}),
			]);
		},
	});
};

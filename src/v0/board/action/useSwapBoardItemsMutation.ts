import { useMutation, useQueryClient } from "@tanstack/react-query";
import { swapFx } from "~/board/fx/swapFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyBoardSwapCachePatch } from "~/v0/board/cache/applyBoardSwapCachePatch";
import { restoreCacheSnapshot } from "~/v0/play/cache/restoreCacheSnapshot";
import { refreshBoardViewCache } from "~/v0/board/cache/refreshBoardViewCache";
import { refreshDatabaseStatusCache } from "~/v0/database/cache/refreshDatabaseStatusCache";

export const useSwapBoardItemsMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, unknown, swapFx.Props, CacheSnapshot.Type>({
		mutationFn(input) {
			return runGameFx({
				effect: swapFx(input),
			});
		},
		onMutate(input) {
			return applyBoardSwapCachePatch({
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

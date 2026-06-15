import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mergeFx } from "~/board/fx/mergeFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyBoardMergeCachePatch } from "~/v0/board/cache/applyBoardMergeCachePatch";
import { restoreCacheSnapshot } from "~/v0/play/cache/restoreCacheSnapshot";
import { refreshBoardAndInventoryCaches } from "~/v0/play/cache/refreshBoardAndInventoryCaches";

export const useMergeBoardItemsMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, unknown, mergeFx.Props, CacheSnapshot.Type>({
		mutationFn(input) {
			return runGameFx({
				effect: mergeFx(input),
			});
		},
		onMutate(input) {
			return applyBoardMergeCachePatch({
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
			await refreshBoardAndInventoryCaches({
				queryClient,
			});
		},
	});
};

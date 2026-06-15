import { useMutation, useQueryClient } from "@tanstack/react-query";
import { stashFx } from "~/inventory/fx/stashFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyInventoryStashCachePatch } from "~/v0/inventory/cache/applyInventoryStashCachePatch";
import { restoreCacheSnapshot } from "~/v0/play/cache/restoreCacheSnapshot";
import { refreshBoardAndInventoryCaches } from "~/v0/play/cache/refreshBoardAndInventoryCaches";

export const useStashBoardItemMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, unknown, stashFx.Props, CacheSnapshot.Type>({
		mutationFn(input) {
			return runGameFx({
				effect: stashFx(input),
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
		async onSuccess() {
			await refreshBoardAndInventoryCaches({
				queryClient,
			});
		},
	});
};

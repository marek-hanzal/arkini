import { useMutation, useQueryClient } from "@tanstack/react-query";
import { placeFx } from "~/inventory/fx/placeFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyInventoryPlaceCachePatch } from "~/v0/inventory/cache/applyInventoryPlaceCachePatch";
import { restoreCacheSnapshot } from "~/v0/play/cache/restoreCacheSnapshot";
import { refreshBoardAndInventoryCaches } from "~/v0/play/cache/refreshBoardAndInventoryCaches";

export const usePlaceInventoryItemMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, unknown, placeFx.Props, CacheSnapshot.Type>({
		mutationFn(input) {
			return runGameFx({
				effect: placeFx(input),
			});
		},
		onMutate(input) {
			return applyInventoryPlaceCachePatch({
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

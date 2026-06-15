import { useMutation, useQueryClient } from "@tanstack/react-query";
import { swapFx } from "~/inventory/fx/swapFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyInventorySwapCachePatch } from "~/v0/inventory/cache/applyInventorySwapCachePatch";
import { restoreCacheSnapshot } from "~/v0/play/cache/restoreCacheSnapshot";
import { refreshDatabaseStatusCache } from "~/v0/database/cache/refreshDatabaseStatusCache";
import { refreshInventoryViewCache } from "~/v0/inventory/cache/refreshInventoryViewCache";

export const useSwapInventorySlotsMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, unknown, swapFx.Props, CacheSnapshot.Type>({
		mutationFn(input) {
			return runGameFx({
				effect: swapFx(input),
			});
		},
		onMutate(input) {
			return applyInventorySwapCachePatch({
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
				refreshInventoryViewCache({
					queryClient,
				}),
				refreshDatabaseStatusCache({
					queryClient,
				}),
			]);
		},
	});
};

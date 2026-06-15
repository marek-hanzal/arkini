import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { swapInventorySlotsFx } from "~/v0/inventory/fx/swapInventorySlotsFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyInventorySwapCachePatch } from "~/v0/inventory/cache/applyInventorySwapCachePatch";
import { restoreCacheSnapshot } from "~/v0/play/cache/restoreCacheSnapshot";
import { applyActionResultCachePatch } from "~/v0/play/cache/applyActionResultCachePatch";

export const useSwapInventorySlotsMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<
		ActionResult.Type,
		GameActionError,
		swapInventorySlotsFx.Props,
		CacheSnapshot.Type
	>({
		mutationFn(input) {
			return runGameFx({
				effect: swapInventorySlotsFx(input),
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
		onSuccess(result) {
			applyActionResultCachePatch({
				queryClient,
				result,
			});
		},
	});
};

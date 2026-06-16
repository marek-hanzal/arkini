import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordActionMutation } from "~/v0/debug/recordActionMutation";
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
			recordActionMutation({
				action: "swapInventorySlots",
				phase: "mutate.start",
				detail: input,
			});
			return runGameFx({
				effect: swapInventorySlotsFx(input),
			});
		},
		onMutate(input) {
			recordActionMutation({
				action: "swapInventorySlots",
				phase: "cache.optimistic.start",
				detail: input,
			});
			return applyInventorySwapCachePatch({
				queryClient,
				input,
			});
		},
		onError(error, _input, snapshot) {
			recordActionMutation({
				action: "swapInventorySlots",
				phase: "mutate.error",
				detail: error,
			});
			recordActionMutation({
				action: "swapInventorySlots",
				phase: "cache.restore",
			});
			restoreCacheSnapshot({
				queryClient,
				snapshot,
			});
		},
		onSuccess(result) {
			recordActionMutation({
				action: "swapInventorySlots",
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

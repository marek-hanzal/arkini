import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordActionMutation } from "~/v0/debug/recordActionMutation";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { placeInventoryItemFx } from "~/v0/inventory/fx/placeInventoryItemFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyInventoryPlaceCachePatch } from "~/v0/inventory/cache/applyInventoryPlaceCachePatch";
import { restoreCacheSnapshot } from "~/v0/play/cache/restoreCacheSnapshot";
import { applyActionResultCachePatch } from "~/v0/play/cache/applyActionResultCachePatch";

export const usePlaceInventoryItemMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<
		ActionResult.Type,
		GameActionError,
		placeInventoryItemFx.Props,
		CacheSnapshot.Type
	>({
		mutationFn(input) {
			recordActionMutation({
				action: "placeInventoryItem",
				phase: "mutate.start",
				detail: input,
			});
			return runGameFx({
				effect: placeInventoryItemFx(input),
			});
		},
		onMutate(input) {
			recordActionMutation({
				action: "placeInventoryItem",
				phase: "cache.optimistic.start",
				detail: input,
			});
			return applyInventoryPlaceCachePatch({
				queryClient,
				input,
			});
		},
		onError(error, _input, snapshot) {
			recordActionMutation({
				action: "placeInventoryItem",
				phase: "mutate.error",
				detail: error,
			});
			recordActionMutation({
				action: "placeInventoryItem",
				phase: "cache.restore",
			});
			restoreCacheSnapshot({
				queryClient,
				snapshot,
			});
		},
		onSuccess(result) {
			recordActionMutation({
				action: "placeInventoryItem",
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

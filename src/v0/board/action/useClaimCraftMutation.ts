import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordActionMutation } from "~/v0/debug/recordActionMutation";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { claimCraftFx } from "~/v0/craft/fx/claimCraftFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyActionResultCachePatch } from "~/v0/play/cache/applyActionResultCachePatch";

export const useClaimCraftMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, GameActionError, claimCraftFx.Props>({
		mutationFn(input) {
			recordActionMutation({
				action: "claimCraft",
				phase: "mutate.start",
				detail: input,
			});
			return runGameFx({
				effect: claimCraftFx(input),
			});
		},
		onError(error) {
			recordActionMutation({
				action: "claimCraft",
				phase: "mutate.error",
				detail: error,
			});
		},
		onSuccess(result) {
			recordActionMutation({
				action: "claimCraft",
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

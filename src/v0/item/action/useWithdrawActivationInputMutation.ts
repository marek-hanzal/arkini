import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordActionMutation } from "~/v0/debug/recordActionMutation";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { withdrawActivationInputFx } from "~/v0/activation/fx/withdrawActivationInputFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyActionResultCachePatch } from "~/v0/play/cache/applyActionResultCachePatch";

export const useWithdrawActivationInputMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, GameActionError, withdrawActivationInputFx.Props>({
		mutationFn(input) {
			recordActionMutation({
				action: "withdrawActivationInput",
				phase: "mutate.start",
				detail: input,
			});
			return runGameFx({
				effect: withdrawActivationInputFx(input),
			});
		},
		onError(error) {
			recordActionMutation({
				action: "withdrawActivationInput",
				phase: "mutate.error",
				detail: error,
			});
		},
		onSuccess(result) {
			recordActionMutation({
				action: "withdrawActivationInput",
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

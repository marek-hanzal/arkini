import { useMutation, useQueryClient } from "@tanstack/react-query";
import { depleteActivationByItemIdFx } from "~/v0/activation/fx/depleteActivationByItemIdFx";
import { recordActionMutation } from "~/v0/debug/recordActionMutation";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { activateBoardItemFx } from "~/v0/activation/fx/activateBoardItemFx";
import type { ActivationResultSchema } from "~/v0/activation/type/ActivationResultSchema";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import { runGameFx } from "~/v0/fx/runGameFx";
import { applyActionResultCachePatch } from "~/v0/play/cache/applyActionResultCachePatch";
import { refreshBoardViewCache } from "~/v0/board/cache/refreshBoardViewCache";
import { resolveActivationDepletionFollowUp } from "~/v0/play/action/resolveActivationDepletionFollowUp";
import type { Feedback } from "~/v0/play/feedback/Feedback";

export type ActivateBoardItemResult = ActionResult.Type & {
	activation?: ActivationResultSchema.Type;
};

export namespace useActivateBoardItemMutation {
	export interface Props {
		feedback?: Feedback.Type;
	}
}

export const useActivateBoardItemMutation = ({
	feedback,
}: useActivateBoardItemMutation.Props = {}) => {
	const queryClient = useQueryClient();

	return useMutation<ActivateBoardItemResult, GameActionError, activateBoardItemFx.Props>({
		mutationFn(input) {
			recordActionMutation({
				action: "activateBoardItem",
				phase: "mutate.start",
				detail: input,
			});
			return runGameFx({
				effect: activateBoardItemFx(input),
			});
		},
		onError(error) {
			recordActionMutation({
				action: "activateBoardItem",
				phase: "mutate.error",
				detail: error,
			});
			feedback?.showError(error);
		},
		onSuccess(result) {
			recordActionMutation({
				action: "activateBoardItem",
				phase: "mutate.success",
				detail: result,
			});
			applyActionResultCachePatch({
				queryClient,
				result,
			});

			const followUp = resolveActivationDepletionFollowUp({
				activation: result.activation,
				visualEvents: result.visualEvents,
			});
			if (!followUp) return;

			globalThis.setTimeout(() => {
				recordActionMutation({
					action: "activateBoardItem",
					phase: "side-effect.start",
					detail: followUp,
				});
				void runGameFx({
					effect: depleteActivationByItemIdFx({
						boardItemId: followUp.boardItemId,
					}),
				})
					.then((depletion) => {
						recordActionMutation({
							action: "activateBoardItem",
							phase: "side-effect.success",
							detail: depletion,
						});
						refreshBoardViewCache({
							queryClient,
						});
					})
					.catch((error) => {
						recordActionMutation({
							action: "activateBoardItem",
							phase: "side-effect.error",
							detail: error,
						});
					});
			}, followUp.delayMs);
		},
	});
};

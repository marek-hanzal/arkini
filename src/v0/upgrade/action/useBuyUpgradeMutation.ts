import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordActionMutation } from "~/v0/debug/recordActionMutation";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { buyUpgradeFx } from "~/v0/upgrade/fx/buyUpgradeFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import { runGameFx } from "~/v0/fx/runGameFx";
import { refreshUpgradePurchaseCaches } from "~/v0/play/cache/refreshUpgradePurchaseCaches";

export const useBuyUpgradeMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, GameActionError, buyUpgradeFx.Props>({
		mutationFn(input) {
			recordActionMutation({
				action: "buyUpgrade",
				phase: "mutate.start",
				detail: input,
			});
			return runGameFx({
				effect: buyUpgradeFx(input),
			});
		},
		onError(error) {
			recordActionMutation({
				action: "buyUpgrade",
				phase: "mutate.error",
				detail: error,
			});
		},
		async onSuccess(result) {
			recordActionMutation({
				action: "buyUpgrade",
				phase: "mutate.success",
				detail: result,
			});
			await refreshUpgradePurchaseCaches({
				queryClient,
			});
		},
	});
};

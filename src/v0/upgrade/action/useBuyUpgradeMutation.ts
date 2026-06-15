import { useMutation, useQueryClient } from "@tanstack/react-query";
import { buyUpgradeFx } from "~/v0/upgrade/fx/buyUpgradeFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import { runGameFx } from "~/v0/fx/runGameFx";
import { refreshUpgradePurchaseCaches } from "~/v0/play/cache/refreshUpgradePurchaseCaches";

export const useBuyUpgradeMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, unknown, buyUpgradeFx.Props>({
		mutationFn(input) {
			return runGameFx({
				effect: buyUpgradeFx(input),
			});
		},
		async onSuccess() {
			await refreshUpgradePurchaseCaches({
				queryClient,
			});
		},
	});
};

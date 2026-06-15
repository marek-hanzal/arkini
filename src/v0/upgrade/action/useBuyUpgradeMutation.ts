import { useMutation, useQueryClient } from "@tanstack/react-query";
import { buyFx } from "~/upgrade/fx/buyFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import { runGameFx } from "~/v0/fx/runGameFx";
import { refreshUpgradePurchaseCaches } from "~/v0/play/cache/refreshUpgradePurchaseCaches";

export const useBuyUpgradeMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, unknown, buyFx.Props>({
		mutationFn(input) {
			return runGameFx({
				effect: buyFx(input),
			});
		},
		async onSuccess() {
			await refreshUpgradePurchaseCaches({
				queryClient,
			});
		},
	});
};

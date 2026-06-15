import { useMutation, useQueryClient } from "@tanstack/react-query";
import { buyFx } from "~/upgrade/fx/buyFx";
import type { MutationResult } from "~/v0/mutation/MutationResult";
import { runGameFx } from "~/v0/mutation/effect/runGameFx";
import { syncUpgradePurchaseViews } from "~/v0/mutation/sync/syncUpgradePurchaseViews";

export const useBuyUpgradeMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<MutationResult, Error, buyFx.Props>({
		mutationFn(input) {
			return runGameFx({
				effect: buyFx(input),
			});
		},
		async onSuccess() {
			await syncUpgradePurchaseViews({
				queryClient,
			});
		},
	});
};

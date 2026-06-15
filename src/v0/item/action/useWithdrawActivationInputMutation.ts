import { useMutation, useQueryClient } from "@tanstack/react-query";
import { withdrawInputFx } from "~/activation/fx/withdrawInputFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import { runGameFx } from "~/v0/fx/runGameFx";
import { refreshBoardAndInventoryCaches } from "~/v0/play/cache/refreshBoardAndInventoryCaches";

export const useWithdrawActivationInputMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, unknown, withdrawInputFx.Props>({
		mutationFn(input) {
			return runGameFx({
				effect: withdrawInputFx(input),
			});
		},
		async onSuccess() {
			await refreshBoardAndInventoryCaches({
				queryClient,
			});
		},
	});
};

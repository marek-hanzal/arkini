import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { withdrawActivationInputFx } from "~/v0/activation/fx/withdrawActivationInputFx";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import { runGameFx } from "~/v0/fx/runGameFx";
import { refreshBoardAndInventoryCaches } from "~/v0/play/cache/refreshBoardAndInventoryCaches";

export const useWithdrawActivationInputMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<ActionResult.Type, GameActionError, withdrawActivationInputFx.Props>({
		mutationFn(input) {
			return runGameFx({
				effect: withdrawActivationInputFx(input),
			});
		},
		async onSuccess() {
			await refreshBoardAndInventoryCaches({
				queryClient,
			});
		},
	});
};

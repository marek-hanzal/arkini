import { Effect } from "effect";

import { useItemDetailPendingCommand } from "~/item-detail-frame/ui/useItemDetailPendingCommand";
import { withdrawLineInputFx } from "~/production-input/fx/withdrawLineInputFx";

export namespace useItemLineInputWithdrawalController {
	export interface Props {
		readonly input: {
			readonly inputIndex: number;
		};
		readonly lineId: string;
		readonly ownerItemId: string;
	}

	export interface Output {
		readonly error: string | null;
		readonly pending: boolean;
		readonly withdraw: () => void;
	}
}

/** Owns the pending command lifecycle for one exact buffered line input. */
export const useItemLineInputWithdrawalController = ({
	input,
	lineId,
	ownerItemId,
}: useItemLineInputWithdrawalController.Props): useItemLineInputWithdrawalController.Output => {
	const command = useItemDetailPendingCommand({
		action: "withdraw",
		failureMessage: "Inputs could not be withdrawn.",
		pendingKey: JSON.stringify([
			"line-input",
			ownerItemId,
			lineId,
			input.inputIndex,
			"withdraw",
		]),
		run: (game, props: withdrawLineInputFx.Props) =>
			game.runFx(withdrawLineInputFx(props)).pipe(Effect.asVoid),
	});

	return {
		error: command.error,
		pending: command.pending,
		withdraw: () =>
			command.run({
				inputIndex: input.inputIndex,
				lineId,
				ownerItemId,
			}),
	};
};

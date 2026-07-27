import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { withdrawLineInputFx } from "~/engine/input/write/withdrawLineInputFx";
import { withdrawLineInputsFx } from "~/engine/input/write/withdrawLineInputsFx";

export namespace useWithdrawItemDetailLine {
	export type Props = withdrawLineInputFx.Props | withdrawLineInputsFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

/** Withdraws one exact input or every buffered root from an Item Detail line. */
export const useWithdrawItemDetailLine = ({
	pendingKey,
	pendingOwner,
}: useWithdrawItemDetailLine.Options) => {
	const game = useGameEngine();
	const runPendingActionFx = pendingOwner.runPendingActionFx;
	const commandAtom = useMemo(
		() =>
			Atom.fn(
				(command: useWithdrawItemDetailLine.Props) =>
					Effect.yieldNow.pipe(
						Effect.andThen(
							runPendingActionFx({
								key: pendingKey,
								action: "withdraw",
								failureMessage: "Inputs could not be withdrawn.",
								run: game
									.runFx(
										"inputIndex" in command
											? withdrawLineInputFx(command)
											: withdrawLineInputsFx(command),
									)
									.pipe(Effect.asVoid),
							}),
						),
					),
				{
					concurrent: true,
				},
			).pipe(Atom.setIdleTTL(0)),
		[
			game,
			pendingKey,
			runPendingActionFx,
		],
	);
	const [result, run] = useAtom(commandAtom);
	return useMemo(
		() => ({
			result,
			run,
		}),
		[
			result,
			run,
		],
	);
};

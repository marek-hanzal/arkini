import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { withdrawLineInputItemFx } from "~/engine/input/write/withdrawLineInputItemFx";
import { withdrawLineInputsFx } from "~/engine/input/write/withdrawLineInputsFx";

export namespace useWithdrawItemDetailLine {
	export type Props = withdrawLineInputsFx.Props | withdrawLineInputItemFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

/** Withdraws one exact buffered root or its complete Item Detail line through canonical placement. */
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
								run:
									"itemId" in command
										? game
												.runFx(withdrawLineInputItemFx(command))
												.pipe(Effect.asVoid)
										: game
												.runFx(withdrawLineInputsFx(command))
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

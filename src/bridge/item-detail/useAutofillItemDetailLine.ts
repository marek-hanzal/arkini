import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";

export namespace useAutofillItemDetailLine {
	export type Props = autofillLineInputsFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

/** Autofills one exact Item Detail line through the canonical input command. */
export const useAutofillItemDetailLine = ({
	pendingKey,
	pendingOwner,
}: useAutofillItemDetailLine.Options) => {
	const game = useGameEngine();
	const runPendingActionFx = pendingOwner.runPendingActionFx;
	const commandAtom = useMemo(
		() =>
			Atom.fn(
				(command: useAutofillItemDetailLine.Props) =>
					Effect.yieldNow.pipe(
						Effect.andThen(
							runPendingActionFx({
								key: pendingKey,
								action: "autofill",
								failureMessage: "Inputs could not be autofilled.",
								run: game.runFx(autofillLineInputsFx(command)),
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

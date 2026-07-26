import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { setDefaultLineFx } from "~/engine/line/write/setDefaultLineFx";

export namespace useSetDefaultItemDetailLine {
	export type Props = setDefaultLineFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

/** Selects one authoritative save-backed default line for an exact Item Detail owner. */
export const useSetDefaultItemDetailLine = ({
	pendingKey,
	pendingOwner,
}: useSetDefaultItemDetailLine.Options) => {
	const game = useGameEngine();
	const runPendingActionFx = pendingOwner.runPendingActionFx;
	const commandAtom = useMemo(
		() =>
			Atom.fn(
				(command: useSetDefaultItemDetailLine.Props) =>
					Effect.yieldNow.pipe(
						Effect.andThen(
							runPendingActionFx({
								key: pendingKey,
								action: "default",
								failureMessage: "Default line could not be changed.",
								run: game.runFx(setDefaultLineFx(command)),
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

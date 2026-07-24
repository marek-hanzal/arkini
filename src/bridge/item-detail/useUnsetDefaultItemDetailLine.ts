import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { unsetDefaultLineFx } from "~/engine/line/write/unsetDefaultLineFx";

export namespace useUnsetDefaultItemDetailLine {
	export type Props = unsetDefaultLineFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

/** Removes the authoritative save-backed default line from an exact Item Detail owner. */
export const useUnsetDefaultItemDetailLine = ({
	pendingKey,
	pendingOwner,
}: useUnsetDefaultItemDetailLine.Options) => {
	const game = useGameEngine();
	const runPendingActionFx = pendingOwner.runPendingActionFx;
	const commandAtom = useMemo(
		() =>
			Atom.fn(
				(command: useUnsetDefaultItemDetailLine.Props) =>
					// TODO(#397): Revalidate stable concurrent-command pending settlement
					// before removing this scheduling boundary.
					Effect.yieldNow.pipe(
						Effect.andThen(
							runPendingActionFx({
								key: pendingKey,
								action: "default",
								failureMessage: "Default line could not be changed.",
								run: game.runFx(unsetDefaultLineFx(command)),
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

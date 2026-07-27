import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { startLineFx } from "~/engine/job/write/startLineFx";

export namespace useStartPendingItemDetailLine {
	export type Props = startLineFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

/** Starts or enqueues one controller-owned Item Detail line request. */
export const useStartPendingItemDetailLine = ({
	pendingKey,
	pendingOwner,
}: useStartPendingItemDetailLine.Options) => {
	const game = useGameEngine();
	const runPendingActionFx = pendingOwner.runPendingActionFx;
	const commandAtom = useMemo(
		() =>
			Atom.fn(
				(command: useStartPendingItemDetailLine.Props) =>
					Effect.yieldNow.pipe(
						Effect.andThen(
							runPendingActionFx({
								key: pendingKey,
								action: "start",
								failureMessage: "Work could not be started.",
								run: game.runFx(startLineFx(command)),
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
	const [result, start] = useAtom(commandAtom);
	return useMemo(
		() => ({
			result,
			start,
		}),
		[
			result,
			start,
		],
	);
};

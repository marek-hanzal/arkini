import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { clearItemJobQueueFx } from "~/engine/job/write/clearItemJobQueueFx";

export namespace useClearItemDetailQueue {
	export type Props = clearItemJobQueueFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

/** Clears only queued line-start intents for one exact Item Detail target. */
export const useClearItemDetailQueue = ({
	pendingKey,
	pendingOwner,
}: useClearItemDetailQueue.Options) => {
	const game = useGameEngine();
	const runPendingActionFx = pendingOwner.runPendingActionFx;
	const commandAtom = useMemo(
		() =>
			Atom.fn(
				(command: useClearItemDetailQueue.Props) =>
					// TODO(#397): Revalidate stable concurrent-command pending settlement
					// before removing this scheduling boundary.
					Effect.yieldNow.pipe(
						Effect.andThen(
							runPendingActionFx({
								key: pendingKey,
								action: "clear-queue",
								failureMessage: "Queue could not be cleared.",
								run: game.runFx(clearItemJobQueueFx(command)),
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

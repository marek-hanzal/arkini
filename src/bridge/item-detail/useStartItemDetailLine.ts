import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import type { Game } from "~/bridge/game/Game";
import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { startLineFx } from "~/engine/job/write/startLineFx";

export namespace useStartItemDetailLine {
	export type Props = startLineFx.Props;

	export interface Options {
		/**
		 * Stable identity for one Tile command result. It prevents unrelated Tile
		 * starts in the same Game from sharing settlement state.
		 */
		readonly commandKey: string;
	}
}

export namespace useStartPendingItemDetailLine {
	export type Props = startLineFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

// TODO(#397): Revalidate both stable concurrent-command pending settlement boundaries in
// this file before removing their scheduling yields.
const createStartItemDetailLineAtom = (game: Game) =>
	Atom.fn(
		(command: useStartItemDetailLine.Props) =>
			Effect.yieldNow.pipe(Effect.andThen(game.runFx(startLineFx(command)))),
		{
			concurrent: true,
		},
	).pipe(Atom.setIdleTTL(0));

type StartItemDetailLineAtom = ReturnType<typeof createStartItemDetailLineAtom>;
export type StartItemDetailLineAsyncResult =
	StartItemDetailLineAtom extends Atom.Atom<infer Result> ? Result : never;

/**
 * Owns one raw Tile start command and its isolated AsyncResult.
 *
 * Typed engine failures remain observable to Tile product policy. Defects and
 * interruptions stay in the AsyncResult Cause for the render boundary.
 */
export const useStartItemDetailLine = ({ commandKey }: useStartItemDetailLine.Options) => {
	const game = useGameEngine();
	const commandAtom = useMemo(
		() => createStartItemDetailLineAtom(game),
		[
			commandKey,
			game,
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

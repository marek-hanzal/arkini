import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/ui/game/makeExactGameAtomFamilyFx";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import { splitBoardItemStackFx } from "~/item-interaction/write/splitBoardItemStackFx";

export namespace runTileSplitAtom {
	export type Command = splitBoardItemStackFx.Props;
}

/** Runs one exact Board-stack split while keeping expected command failures recoverable. */
export const runTileSplitAtom = RendererRuntime.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn(
			(command: runTileSplitAtom.Command) =>
				Effect.yieldNow.pipe(
					Effect.andThen(
						game.runFx(splitBoardItemStackFx(command)).pipe(
							Effect.as(true),
							Effect.catch(() => Effect.succeed(false)),
						),
					),
				),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0)),
	),
);

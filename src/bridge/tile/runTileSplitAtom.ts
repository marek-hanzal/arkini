import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { splitBoardItemStackFx } from "~/engine/runtime/write/splitBoardItemStackFx";

export namespace runTileSplitAtom {
	export type Command = splitBoardItemStackFx.Props;
	export type Result = boolean;
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

import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/game-presentation/fx/makeExactGameAtomFamilyFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { splitBoardItemStackFx } from "~/item-interaction/fx/splitBoardItemStackFx";

/** Runs one exact Board-stack split while keeping expected command failures recoverable. */
export const runTileSplitAtom = RendererRuntime.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn(
			(command: splitBoardItemStackFx.Props) =>
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

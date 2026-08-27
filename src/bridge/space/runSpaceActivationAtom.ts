import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { activateSpaceItemFx } from "~/engine/space/write/activateSpaceItemFx";

export namespace runSpaceActivationAtom {
	export type Command = activateSpaceItemFx.Props;
	export type Result = boolean;
}

/** Runs one exact Space activation while keeping expected command rejection recoverable. */
export const runSpaceActivationAtom = RendererRuntime.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn(
			(command: runSpaceActivationAtom.Command) =>
				Effect.yieldNow.pipe(
					Effect.andThen(
						game.runFx(activateSpaceItemFx(command)).pipe(
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

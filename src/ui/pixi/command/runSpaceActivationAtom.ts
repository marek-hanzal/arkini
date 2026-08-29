import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/ui/game/makeExactGameAtomFamilyFx";
import { RendererRuntime } from "~/application-runtime/RendererRuntime";
import type { activateSpaceItemFx } from "~/space-action/write/activateSpaceItemFx";
import { activateSpaceItemWithTransitionFx } from "~/space-action/write/activateSpaceItemFx";

export namespace runSpaceActivationAtom {
	export type Command = activateSpaceItemFx.Props;
}

/** Returns the command's exact optional commit while keeping expected rejection recoverable. */
export const runSpaceActivationAtom = RendererRuntime.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn(
			(command: runSpaceActivationAtom.Command) =>
				Effect.yieldNow.pipe(
					Effect.andThen(
						game.runFx(activateSpaceItemWithTransitionFx(command)).pipe(
							Effect.map(({ transition }) => ({
								transition,
							})),
							Effect.catch(() => Effect.succeed(null)),
						),
					),
				),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0)),
	),
);

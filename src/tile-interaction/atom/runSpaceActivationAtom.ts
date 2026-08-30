import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/ui/game/makeExactGameAtomFamilyFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { activateSpaceItemFx } from "~/space-action/fx/activateSpaceItemFx";
import { activateSpaceItemWithTransitionFx } from "~/space-action/fx/activateSpaceItemFx";

type Command = activateSpaceItemFx.Props;

/** Returns the command's exact optional commit while keeping expected rejection recoverable. */
export const runSpaceActivationAtom = RendererRuntime.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn(
			(command: Command) =>
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

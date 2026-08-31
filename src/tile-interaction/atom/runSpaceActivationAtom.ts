import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/game-presentation/fx/makeExactGameAtomFamilyFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { activateSpaceItemFx } from "~/space-action/fx/activateSpaceItemFx";
import { activateSpaceItemWithTransitionFx } from "~/space-action/fx/activateSpaceItemFx";

/** Returns the command's exact optional commit while keeping expected rejection recoverable. */
export const runSpaceActivationAtom = RendererRuntime.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn(
			(command: activateSpaceItemFx.Props) =>
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

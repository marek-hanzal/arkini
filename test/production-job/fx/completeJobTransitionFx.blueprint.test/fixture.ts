import { Effect, type Layer } from "effect";

import { useGameFx } from "~test/support/useGameFx";
import type { GameLayerFx } from "~test/support/GameLayerFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { blueprintConfig } from "~test/production-job/fx/completeJobTransitionFx.blueprint.test/config";

export const spawnBlueprintFx = Effect.fn("spawnBlueprintFx")(function* ({
	id,
	itemUid,
	space,
	x,
	y,
}: {
	id: string;
	itemUid:
		| "blueprint:depletion-capped"
		| "blueprint:depletion-random"
		| "blueprint:depletion-self"
		| "blueprint:outcome"
		| "blueprint:plain"
		| "blueprint:range"
		| "blueprint:reserve";
	space: number;
	x: number;
	y: number;
}) {
	return yield* spawnItemFx({
		id,
		itemUid,
		location: {
			scope: "board",
			space,
			position: {
				x,
				y,
			},
		},
	});
});

export const runBlueprint = <A, E>(
	effect: Effect.Effect<A, E, Layer.Success<ReturnType<typeof GameLayerFx>>>,
) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: blueprintConfig,
			}),
		),
	);

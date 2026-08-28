import { Effect, type Layer } from "effect";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import type { GameLayerFx } from "~/engine/game/layer/GameLayerFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { blueprintConfig } from "~test/job/fx/completeJobTransitionFx.blueprint.test/config";

export const spawnBlueprintFx = Effect.fn("spawnBlueprintFx")(function* ({
	id,
	itemId,
	space,
	x,
	y,
}: {
	id: string;
	itemId:
		| "blueprint:capped"
		| "blueprint:depletion-capped"
		| "blueprint:depletion-random"
		| "blueprint:depletion-self"
		| "blueprint:depletion-self-no-output"
		| "blueprint:output"
		| "blueprint:plain"
		| "blueprint:range"
		| "blueprint:reserve";
	space: number;
	x: number;
	y: number;
}) {
	return yield* spawnItemFx({
		id,
		itemId,
		location: {
			scope: "board",
			space,
			position: {
				x,
				y,
			},
		},
		quantity: 1,
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

export const sourceLine = (lineId: string) => {
	const source = blueprintConfig.items["producer:blueprint-source"];
	if (source?.type !== "producer") throw new Error("Missing blueprint source producer.");
	const line = source.lines.find((candidate) => candidate.id === lineId);
	if (line === undefined) throw new Error(`Missing source line ${lineId}.`);
	return line;
};

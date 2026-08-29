import { Effect, type Layer } from "effect";

import { useGameFx } from "~test/support/game/useGameFx";
import type { GameLayerFx } from "~/engine/game/layer/GameLayerFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { craftCompletionConfig } from "~test/job/fx/completeJobTransitionFx.craft.test/config";

type CraftItemId =
	| "craft:drop"
	| "craft:ordered-output"
	| "craft:random"
	| "craft:reserve"
	| "craft:sink";

export const runCraft = <A, E>(
	effect: Effect.Effect<A, E, Layer.Success<ReturnType<typeof GameLayerFx>>>,
) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: craftCompletionConfig,
			}),
		),
	);

export const spawnCraftFx = Effect.fn("spawnCraftFx")(function* ({
	itemId,
	quantity = 1,
}: {
	readonly itemId: CraftItemId;
	readonly quantity?: number;
}) {
	return yield* spawnItemFx({
		id: `runtime:${itemId}`,
		itemId,
		location: {
			position: {
				x: 0,
				y: 0,
			},
			scope: "board",
			space: 0,
		},
		quantity,
	});
});

export const projectRandomCraftOutputFx = Effect.fn("projectRandomCraftOutputFx")(function* ({
	runtime,
}: {
	readonly runtime: RuntimeSchema.Type;
}) {
	return runtime.items
		.filter((item) => item.item.id === "item:random-a" || item.item.id === "item:random-b")
		.map((item) => ({
			itemId: item.item.id,
			location: item.location,
			quantity: item.quantity,
		}))
		.sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second)));
});

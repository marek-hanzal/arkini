import { Effect } from "effect";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import {
	type ItemDetailReference,
	projectItemDetailReferenceFx,
} from "~/item-detail-frame/fx/projectItemDetailReferenceFx";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readItemDetailQueueFx } from "~/item-detail-read/fx/readItemDetailQueueFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

type EngineQueue = Extract<
	readItemDetailQueueFx.Result,
	{
		readonly kind: "available";
	}
>;

type ProjectedWork<
	Work extends {
		readonly outputItemId?: IdSchema.Type;
	},
> = Omit<Work, "outputItemId"> & {
	readonly identity?: ItemDetailReference;
};

interface Props {
	readonly game: GameEngine;
	readonly itemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

export type ItemDetailQueueProjection =
	| {
			readonly kind: "available";
			readonly itemId: EngineQueue["itemId"];
			readonly capacity: EngineQueue["capacity"];
			readonly active: readonly ProjectedWork<EngineQueue["active"][number]>[];
			readonly request: readonly ProjectedWork<EngineQueue["request"][number]>[];
	  }
	| {
			readonly kind: "unavailable";
	  };

const projectWorkIdentityFx = Effect.fn("projectItemDetailQueueWorkIdentityFx")(function* <
	Work extends {
		readonly outputItemId?: IdSchema.Type;
	},
>({
	game,
	runtime,
	work,
}: {
	readonly game: GameEngine;
	readonly runtime: RuntimeSchema.Type;
	readonly work: Work;
}) {
	const { outputItemId, ...projected } = work;
	const identity =
		outputItemId === undefined
			? undefined
			: yield* projectItemDetailReferenceFx({
					game,
					itemId: outputItemId,
					runtime,
				});
	return {
		...projected,
		...(identity === undefined
			? {}
			: {
					identity,
				}),
	} as ProjectedWork<Work>;
});

/** Adds renderer artwork identities to the engine-authoritative queue projection. */
export const projectItemDetailQueueFx = Effect.fn("projectItemDetailQueueFx")(function* ({
	game,
	itemId,
	runtime,
}: Props) {
	const queue = yield* readItemDetailQueueFx({
		itemId,
		runtime,
	});
	if (queue.kind === "unavailable") {
		return {
			kind: "unavailable",
		} satisfies ItemDetailQueueProjection;
	}
	const [active, request] = yield* Effect.all([
		Effect.all(
			queue.active.map((work) =>
				projectWorkIdentityFx({
					game,
					runtime,
					work,
				}),
			),
		),
		Effect.all(
			queue.request.map((work) =>
				projectWorkIdentityFx({
					game,
					runtime,
					work,
				}),
			),
		),
	]);
	return {
		kind: "available",
		itemId: queue.itemId,
		capacity: queue.capacity,
		active,
		request,
	} satisfies ItemDetailQueueProjection;
});

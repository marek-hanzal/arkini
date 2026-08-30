import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { readOutputPlacementItemEventsFx } from "~/game-event/fx/readOutputPlacementItemEventsFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { isItemPureFn } from "~/engine/item/fn/isItemPureFn";
import { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { isGridRuntimeItemFn } from "~/game-runtime/read/fn/isGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace isolateGridStatefulOwnerTransitionFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Keeps one state-owning grid identity and places its pure remainder from its real origin. */
export const isolateGridStatefulOwnerTransitionFx = Effect.fn(
	"isolateGridStatefulOwnerTransitionFx",
)(function* ({ ownerItemId, runtime }: isolateGridStatefulOwnerTransitionFx.Props) {
	const runtimeOwner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const owner = Option.getOrUndefined(isGridRuntimeItemFn(runtimeOwner));
	if (owner === undefined) {
		return yield* Effect.fail(
			new ItemNotOnGridError({
				itemId: runtimeOwner.id,
				location: runtimeOwner.location,
			}),
		);
	}
	if (owner.quantity === 1) {
		return {
			events: [],
			runtime,
		} satisfies isolateGridStatefulOwnerTransitionFx.Result;
	}

	const pure = isItemPureFn({
		item: owner,
		runtime,
	});
	if (pure) {
		return yield* Effect.die(
			new Error(`Owner ${owner.id} must own identity-bound state before it can be isolated.`),
		);
	}

	const statefulOwner = yield* reviseRuntimeItemFx({
		item: {
			...owner,
			quantity: 1,
		},
	});
	const ownerRuntime = {
		...runtime,
		items: runtime.items.map((item) => (item.id === owner.id ? statefulOwner : item)),
	} satisfies RuntimeSchema.Type;
	const [placement, nextRuntime] = yield* applyOutputPlacementFx({
		origin: owner.location,
		output: {
			drop: [
				{
					itemId: owner.item.id,
					quantity: owner.quantity - 1,
					placement: PlacementSchema.enum.Drop,
				},
			],
		},
		runtime: ownerRuntime,
	});
	const placementEvents = yield* readOutputPlacementItemEventsFx({
		originItemId: ownerItemId,
		placement,
	});
	return {
		events: [
			{
				type: GameEventEnumSchema.enum.ItemSplit,
				itemId: owner.id,
				canonicalItemId: owner.item.id,
				location: owner.location,
				previousQuantity: owner.quantity,
				quantity: 1,
			},
			...placementEvents,
		],
		runtime: nextRuntime,
	} satisfies isolateGridStatefulOwnerTransitionFx.Result;
});

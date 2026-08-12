import { Effect, Option } from "effect";

import { PlacementEnumSchema } from "~/engine/placement/schema/PlacementEnumSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { ItemStatefulError } from "~/engine/item/error/ItemStatefulError";
import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import { assertOwnerIdleFx } from "~/engine/job/fx/assertOwnerIdleFx";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { ItemJobScopedError } from "~/engine/runtime/error/ItemJobScopedError";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { applyPlacementPlanFx } from "./applyPlacementPlanFx";
import { planPolicyDropPlacementFx } from "./planPolicyDropPlacementFx";
import { readPolicyRuntimeItemDropLocationFx } from "./readPolicyRuntimeItemDropLocationFx";

export namespace placeRuntimeItemFx {
	export interface Props {
		itemId: IdSchema.Type;
		origin: BoardLocationSchema.Type;
		originItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Returns one existing input-buffered, reserved, or Inventory item through the
 * canonical drop policy and reports the exact visible placement facts.
 */
export const placeRuntimeItemFx = Effect.fn("placeRuntimeItemFx")(function* ({
	itemId,
	origin,
	originItemId,
	runtime,
}: placeRuntimeItemFx.Props) {
	const item = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	if (item.location.scope === LocationScopeEnumSchema.enum.Job) {
		return yield* Effect.fail(
			new ItemJobScopedError({
				itemId: item.id,
				jobId: item.location.jobId,
			}),
		);
	}
	if (
		item.location.scope !== LocationScopeEnumSchema.enum.Input &&
		item.location.scope !== LocationScopeEnumSchema.enum.Reserved &&
		item.location.scope !== LocationScopeEnumSchema.enum.Inventory
	) {
		return yield* Effect.die(
			new Error(
				`Existing-item placement only accepts input, reserved, or Inventory items; ${item.id} is ${item.location.scope}.`,
			),
		);
	}
	if (item.location.scope !== LocationScopeEnumSchema.enum.Inventory) {
		yield* assertOwnerIdleFx({
			ownerItemId: item.id,
			runtime,
		});
	}
	const pure = yield* isItemPureFx({
		item,
		runtime,
	});
	const detachedRuntime = {
		...runtime,
		items: runtime.items.filter((candidate) => candidate.id !== item.id),
	} satisfies RuntimeSchema.Type;

	if (pure) {
		const plan = yield* planPolicyDropPlacementFx({
			drop: {
				itemId: item.item.id,
				placement: PlacementEnumSchema.enum.Drop,
				quantity: item.quantity,
			},
			origin,
			runtime: detachedRuntime,
		});
		const [placement, placedRuntime] = yield* applyPlacementPlanFx({
			plan,
			runtime: detachedRuntime,
		});
		const events: GameEventSchema.Type[] = [];
		for (const stack of placement.stack) {
			const stackedItem = Option.getOrUndefined(yield* isGridRuntimeItemFx(stack.item));
			if (stackedItem === undefined) {
				return yield* Effect.die(
					new Error(
						`Existing-item placement stacked ${stack.item.id} outside a visible grid scope.`,
					),
				);
			}
			events.push({
				type: GameEventEnumSchema.enum.ItemStacked,
				itemId: stackedItem.id,
				canonicalItemId: stackedItem.item.id,
				originItemId,
				location: stackedItem.location,
				previousQuantity: stackedItem.quantity - stack.quantity,
				quantity: stackedItem.quantity,
			});
		}
		for (const runtimeSpawnedItem of placement.spawn) {
			const spawnedItem = Option.getOrUndefined(
				yield* isGridRuntimeItemFx(runtimeSpawnedItem),
			);
			if (spawnedItem === undefined) {
				return yield* Effect.die(
					new Error(
						`Existing-item placement spawned ${runtimeSpawnedItem.id} outside a visible grid scope.`,
					),
				);
			}
			events.push({
				type: GameEventEnumSchema.enum.ItemSpawned,
				itemId: spawnedItem.id,
				canonicalItemId: spawnedItem.item.id,
				originItemId,
				location: spawnedItem.location,
				quantity: spawnedItem.quantity,
			});
		}
		return {
			events,
			runtime: placedRuntime,
		} satisfies placeRuntimeItemFx.Result;
	}

	if (item.quantity !== 1) {
		return yield* Effect.fail(
			new ItemStatefulError({
				itemId: item.id,
			}),
		);
	}
	const location = yield* readPolicyRuntimeItemDropLocationFx({
		item,
		origin,
		runtime: detachedRuntime,
	});
	const placedItem = yield* reviseRuntimeItemFx({
		item: {
			...item,
			location,
		} satisfies GridRuntimeItemSchema.Type,
	});
	const placedRuntime = {
		...runtime,
		items: runtime.items.map((candidate) => {
			return candidate.id === item.id ? placedItem : candidate;
		}),
	} satisfies RuntimeSchema.Type;

	return {
		events: [
			{
				type: GameEventEnumSchema.enum.ItemPlaced,
				itemId: item.id,
				canonicalItemId: item.item.id,
				originItemId,
				previousLocation: item.location,
				location: placedItem.location,
				quantity: placedItem.quantity,
			},
		],
		runtime: placedRuntime,
	} satisfies placeRuntimeItemFx.Result;
});

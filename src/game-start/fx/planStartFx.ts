import { Data, Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { InventoryLocationSchema } from "~/item-location/schema/InventoryLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { ToolbarLocationSchema } from "~/item-location/schema/ToolbarLocationSchema";
import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";
import { readPlacementPlanQuantityFn } from "~/item-placement/fn/readPlacementPlanQuantityFn";
import { applyPlacementPlanFx } from "~/item-placement/fx/applyPlacementPlanFx";
import { planSpawnPlacementFx } from "~/item-placement/fx/planSpawnPlacementFx";
import { assertRuntimeFx } from "~/game-runtime/check/assertRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { StartSchema } from "~/game-start/schema/StartSchema";

type StartGridLocation =
	| BoardLocationSchema.Type
	| InventoryLocationSchema.Type
	| ToolbarLocationSchema.Type;

interface PlanStartProps {
	readonly runtime: RuntimeSchema.Type;
	readonly start: StartSchema.Type;
}

interface ApplyExactGridStackProps {
	readonly runtime: RuntimeSchema.Type;
	readonly itemId: IdSchema.Type;
	readonly location: StartGridLocation;
	readonly quantity: PositiveIntegerSchema.Type;
}

/** One exact initial grid slot cannot hold the complete requested stack quantity. */
class StartSlotUnavailableError extends Data.TaggedError("StartSlotUnavailableError")<{
	itemId: IdSchema.Type;
	quantity: PositiveIntegerSchema.Type;
	remainingQuantity: PositiveIntegerSchema.Type;
	scope:
		| typeof LocationScopeEnumSchema.enum.Board
		| typeof LocationScopeEnumSchema.enum.Inventory
		| typeof LocationScopeEnumSchema.enum.Toolbar;
}> {}

const applyExactGridStackFx = Effect.fn("planStartFx.applyExactGridStackFx")(function* ({
	runtime,
	itemId,
	location,
	quantity,
}: ApplyExactGridStackProps) {
	const item = yield* resolveItemFx({
		itemId,
	});
	const spawn = yield* planSpawnPlacementFx({
		item,
		locations: [
			location,
		],
		quantity,
	});
	const plan = {
		remove: [],
		spawn,
		stack: [],
	} satisfies PlacementPlan;
	const placedQuantity = readPlacementPlanQuantityFn({
		plan,
	});
	if (placedQuantity !== quantity) {
		return yield* Effect.fail(
			new StartSlotUnavailableError({
				itemId,
				quantity,
				remainingQuantity: quantity - placedQuantity,
				scope: location.scope,
			}),
		);
	}
	const [, nextRuntime] = yield* applyPlacementPlanFx({
		plan,
		runtime,
	});
	return nextRuntime;
});

/** Builds the exact initial runtime by applying every start entry sequentially. */
export const planStartFx = Effect.fn("planStartFx")(function* ({ runtime, start }: PlanStartProps) {
	const board = yield* Effect.reduce(
		start.board,
		() => ({
			...runtime,
			currentSpace: start.currentSpace,
		}),
		(draft, item) =>
			applyExactGridStackFx({
				itemId: item.itemId,
				location: {
					space: item.space,
					position: {
						x: item.x,
						y: item.y,
					},
					scope: LocationScopeEnumSchema.enum.Board,
				},
				quantity: item.quantity ?? 1,
				runtime: draft,
			}),
	);
	const inventory = yield* Effect.reduce(
		start.inventory,
		() => board,
		(draft, item) =>
			applyExactGridStackFx({
				itemId: item.itemId,
				location: {
					position: item.position,
					scope: LocationScopeEnumSchema.enum.Inventory,
				},
				quantity: item.quantity,
				runtime: draft,
			}),
	);
	const toolbar = yield* Effect.reduce(
		start.toolbar,
		() => inventory,
		(draft, item) =>
			applyExactGridStackFx({
				itemId: item.itemId,
				location: {
					position: item.position,
					scope: LocationScopeEnumSchema.enum.Toolbar,
				},
				quantity: item.quantity ?? 1,
				runtime: draft,
			}),
	);

	yield* assertRuntimeFx({
		runtime: toolbar,
	});

	return toolbar;
});

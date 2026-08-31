import { Array, Effect, Order } from "effect";

import type { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";
import type { PositionSchema } from "~/item-location/schema/PositionSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { isItemPureFn } from "~/game-runtime/fn/isItemPureFn";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import { readGridLocationKeyFn } from "~/item-location/fn/readGridLocationKeyFn";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { readEmptyLocationsFn } from "~/item-placement/fn/readEmptyLocationsFn";
import { readPlacementPlanQuantityFn } from "~/item-placement/fn/readPlacementPlanQuantityFn";
import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";
import { narrowGridRuntimeItemFn } from "~/game-runtime/fn/narrowGridRuntimeItemFn";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { planSpawnPlacementFx } from "./planSpawnPlacementFx";

interface PlanScopePlacementProps {
	readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
	readonly item: ItemSchema.Type;
	readonly locations: ReadonlyArray<GridLocationSchema.Type>;
	readonly origin?: PositionSchema.Type;
	readonly quantity: PositiveIntegerSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

const readAvailableStackItemsFn = ({
	itemId,
	locations,
	origin,
	runtime,
}: {
	readonly itemId: string;
	readonly locations: ReadonlyArray<GridLocationSchema.Type>;
	readonly origin?: PositionSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const locationKeys = new Set(locations.map(readGridLocationKeyFn));
	return Array.getSomes(runtime.items.map(narrowGridRuntimeItemFn))
		.filter(
			(item) =>
				locationKeys.has(readGridLocationKeyFn(item.location)) &&
				item.item.id === itemId &&
				item.quantity < item.item.maxStackSize &&
				isItemPureFn({
					item,
					runtime,
				}),
		)
		.sort((left, right) => {
			const scanOrder =
				left.location.position.y - right.location.position.y ||
				left.location.position.x - right.location.position.x ||
				Order.String(left.id, right.id);
			if (origin === undefined) return scanOrder;

			const leftDistance =
				Math.abs(left.location.position.x - origin.x) +
				Math.abs(left.location.position.y - origin.y);
			const rightDistance =
				Math.abs(right.location.position.x - origin.x) +
				Math.abs(right.location.position.y - origin.y);
			return leftDistance - rightDistance || scanOrder;
		});
};

const planStackPlacementFn = ({
	items,
	quantity,
}: {
	readonly items: ReadonlyArray<GridRuntimeItemSchema.Type>;
	readonly quantity: PositiveIntegerSchema.Type;
}) => {
	const stack: PlacementPlan["stack"][number][] = [];
	let remainingQuantity = quantity;
	for (const item of items) {
		const placedQuantity = Math.min(remainingQuantity, item.item.maxStackSize - item.quantity);
		if (placedQuantity > 0) {
			stack.push({
				itemId: item.id,
				quantity: placedQuantity,
			});
			remainingQuantity -= placedQuantity;
		}
		if (remainingQuantity === 0) break;
	}
	return stack;
};

/** Plans stack-first placement within one concrete runtime scope. */
export const planScopePlacementFx = Effect.fn("planScopePlacementFx")(function* ({
	excludedLocations = [],
	item,
	locations,
	origin,
	quantity,
	runtime,
}: PlanScopePlacementProps) {
	const eligibleLocations: GridLocationSchema.Type[] = [];
	for (const location of locations) {
		let excluded = false;
		for (const excludedLocation of excludedLocations) {
			if (
				isSameGridLocationFn({
					left: location,
					right: excludedLocation,
				})
			) {
				excluded = true;
				break;
			}
		}
		if (!excluded) eligibleLocations.push(location);
	}
	const availableStacks = readAvailableStackItemsFn({
		itemId: item.id,
		locations: eligibleLocations,
		origin,
		runtime,
	});
	const stack = planStackPlacementFn({
		items: availableStacks,
		quantity,
	});
	const stackPlan = {
		remove: [],
		spawn: [],
		stack,
	} satisfies PlacementPlan;
	const stackedQuantity = readPlacementPlanQuantityFn({
		plan: stackPlan,
	});
	const remainingQuantity = quantity - stackedQuantity;
	if (remainingQuantity === 0) {
		return stackPlan;
	}

	const emptyLocations = readEmptyLocationsFn({
		locations: eligibleLocations,
		runtime,
	});
	const spawn = yield* planSpawnPlacementFx({
		item,
		locations: emptyLocations,
		quantity: remainingQuantity,
	});

	return {
		remove: [],
		spawn,
		stack,
	} satisfies PlacementPlan;
});

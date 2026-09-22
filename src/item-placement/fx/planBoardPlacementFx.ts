import { Array, Effect, Order, Random } from "effect";
import { match } from "ts-pattern";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { SizeSchema } from "~/item-location/schema/SizeSchema";
import type { PositionSchema } from "~/item-location/schema/PositionSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { orderGridLocationsFn } from "~/item-placement/fn/orderGridLocationsFn";
import { readBoardLocationsFn } from "~/item-placement/fn/readBoardLocationsFn";
import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { isItemPureFn } from "~/game-runtime/fn/isItemPureFn";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import { readGridLocationKeyFn } from "~/item-location/fn/readGridLocationKeyFn";
import { readEmptyLocationsFn } from "~/item-placement/fn/readEmptyLocationsFn";
import { readPlacementPlanQuantityFn } from "~/item-placement/fn/readPlacementPlanQuantityFn";
import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import { planSpawnPlacementFx } from "./planSpawnPlacementFx";

const readAvailableStackItemsFn = ({
	itemId,
	locations,
	origin,
	runtime,
}: {
	readonly itemId: string;
	readonly locations: ReadonlyArray<BoardLocationSchema.Type>;
	readonly origin: PositionSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const locationKeys = new Set(locations.map(readGridLocationKeyFn));
	return Array.getSomes(runtime.items.map(narrowBoardRuntimeItemFn))
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
	readonly items: ReadonlyArray<BoardRuntimeItemSchema.Type>;
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

interface PlanBoardPlacementProps {
	readonly excludedLocations?: ReadonlyArray<BoardLocationSchema.Type>;
	readonly item: ItemSchema.Type;
	readonly origin: BoardLocationSchema.Type;
	readonly placement: PlacementSchema.Type;
	readonly quantity: PositiveIntegerSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

const resolveBoardPlacementOriginFx = Effect.fn("resolveBoardPlacementOriginFx")(function* ({
	origin,
	placement,
	size,
}: {
	readonly origin: BoardLocationSchema.Type;
	readonly placement: PlacementSchema.Type;
	readonly size: SizeSchema.Type;
}) {
	return yield* match(placement)
		.with(PlacementSchema.enum.Drop, () => Effect.succeed(origin.position))
		.with(PlacementSchema.enum.Random, () =>
			Random.nextIntBetween(0, size.width * size.height, {
				halfOpen: true,
			}).pipe(
				Effect.map(
					(index) =>
						({
							x: index % size.width,
							y: Math.floor(index / size.width),
						}) satisfies PositionSchema.Type,
				),
			),
		)
		.exhaustive();
});

/** Plans stack-first placement in one Board space around its physical or randomized origin. */
export const planBoardPlacementFx = Effect.fn("planBoardPlacementFx")(function* ({
	excludedLocations = [],
	item,
	origin,
	placement,
	quantity,
	runtime,
}: PlanBoardPlacementProps) {
	const config = yield* GameConfigFx;
	const placementOrigin = yield* resolveBoardPlacementOriginFx({
		origin,
		placement,
		size: config.meta.board,
	});
	const boardLocations = readBoardLocationsFn({
		size: config.meta.board,
		space: origin.space,
	});
	const locations = orderGridLocationsFn({
		locations: boardLocations,
		origin: placementOrigin,
	});

	const eligibleLocations: BoardLocationSchema.Type[] = [];
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
	const availableStacks =
		item.maxStackSize === 1
			? []
			: readAvailableStackItemsFn({
					itemId: item.id,
					locations: eligibleLocations,
					origin: placementOrigin,
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

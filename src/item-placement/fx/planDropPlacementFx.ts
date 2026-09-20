import { Effect } from "effect";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";
import { readGridLocationClaimsFn } from "~/item-location/fn/readGridLocationClaimsFn";
import { readGridLocationKeyFn } from "~/item-location/fn/readGridLocationKeyFn";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { PositionSchema } from "~/item-location/schema/PositionSchema";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import { orderGridLocationsFn } from "~/item-placement/fn/orderGridLocationsFn";
import { readPlacementPlanQuantityFn } from "~/item-placement/fn/readPlacementPlanQuantityFn";
import { readPlacementRouteFn } from "~/item-placement/fn/readPlacementRouteFn";
import { readToolbarLocationsFn } from "~/item-placement/fn/readToolbarLocationsFn";
import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";
import type { dropFx } from "~/production-output/fx/dropFx";
import { resolveItemFx } from "~/item-resolution/fx/resolveItemFx";

import { assertPlacementPlanCompleteFx } from "./assertPlacementPlanCompleteFx";
import { planBoardPlacementFx } from "./planBoardPlacementFx";
import { planInventoryPlacementFx } from "./planInventoryPlacementFx";
import { planScopePlacementFx } from "./planScopePlacementFx";

interface PlanDropPlacementProps {
	readonly drop: dropFx.Result;
	readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
	readonly origin: GridLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

interface PlanConcreteScopePlacementProps {
	readonly drop: dropFx.Result;
	readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
	readonly item: ItemSchema.Type;
	readonly origin: GridLocationSchema.Type;
	readonly quantity: PositiveIntegerSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly scope: readPlacementRouteFn.Scope;
}

interface PlanToolbarPlacementProps {
	readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
	readonly item: ItemSchema.Type;
	readonly origin?: PositionSchema.Type;
	readonly quantity: PositiveIntegerSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

const mergePlacementPlansFn = ({ plans }: { readonly plans: ReadonlyArray<PlacementPlan> }) => ({
	remove: plans.flatMap((plan) => plan.remove),
	spawn: plans.flatMap((plan) => plan.spawn),
	stack: plans.flatMap((plan) => plan.stack),
});

const planToolbarPlacementFx = Effect.fn("planToolbarPlacementFx")(function* ({
	excludedLocations,
	item,
	origin,
	quantity,
	runtime,
}: PlanToolbarPlacementProps) {
	const config = yield* GameConfigFx;
	const locations = readToolbarLocationsFn({
		size: config.meta.toolbarSize ?? 0,
	});
	const orderedLocations =
		origin === undefined
			? locations
			: orderGridLocationsFn({
					locations,
					origin,
				});
	return yield* planScopePlacementFx({
		excludedLocations,
		item,
		locations: orderedLocations,
		origin,
		quantity,
		runtime,
	});
});

const assertBoardOnlyCapacityFx = Effect.fn("assertBoardOnlyCapacityFx")(function* ({
	drop,
	excludedLocations,
	item,
	origin,
	runtime,
}: {
	readonly drop: dropFx.Result;
	readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
	readonly item: ItemSchema.Type;
	readonly origin: GridLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	if (item.scope !== StorageSchema.enum.Board || item.maxStackSize !== 1) return;

	const config = yield* GameConfigFx;
	const boardSpace = origin.scope === "board" ? origin.space : runtime.currentSpace;
	const occupied = new Set<string>();
	for (const location of [
		...readGridLocationClaimsFn({
			runtime,
		}).map((claim) => claim.location),
		...(excludedLocations ?? []),
	]) {
		if (
			location.scope === "board" &&
			location.space === boardSpace &&
			location.position.x >= 0 &&
			location.position.x < config.meta.board.width &&
			location.position.y >= 0 &&
			location.position.y < config.meta.board.height
		) {
			occupied.add(readGridLocationKeyFn(location));
		}
	}
	const available = config.meta.board.width * config.meta.board.height - occupied.size;
	if (available >= drop.quantity) return;

	return yield* Effect.fail(
		new PlacementUnavailableError({
			itemId: item.id,
			placement: drop.placement,
			quantity: drop.quantity,
			reason: PlacementUnavailableError.Reason.BoardFull,
			remainingQuantity: drop.quantity - available,
		}),
	);
});

const planConcreteScopePlacementFx = Effect.fn("planConcreteScopePlacementFx")(function* ({
	drop,
	excludedLocations,
	item,
	origin,
	quantity,
	runtime,
	scope,
}: PlanConcreteScopePlacementProps) {
	switch (scope) {
		case "board":
			return yield* planBoardPlacementFx({
				excludedLocations: excludedLocations?.filter(
					(location): location is BoardLocationSchema.Type => location.scope === "board",
				),
				item,
				origin: origin.scope === "board" ? origin : undefined,
				placement: drop.placement,
				quantity,
				runtime,
			});
		case "inventory":
			return yield* planInventoryPlacementFx({
				excludedLocations,
				item,
				origin: origin.scope === "inventory" ? origin.position : undefined,
				quantity,
				runtime,
			});
		case "toolbar":
			return yield* planToolbarPlacementFx({
				excludedLocations,
				item,
				origin: origin.scope === "toolbar" ? origin.position : undefined,
				quantity,
				runtime,
			});
	}
});

/** Plans one complete all-or-nothing drop through its authored board strategy and scope. */
export const planDropPlacementFx = Effect.fn("planDropPlacementFx")(function* ({
	drop,
	excludedLocations,
	origin,
	runtime,
}: PlanDropPlacementProps) {
	const item = yield* resolveItemFx({
		itemId: drop.itemId,
	});
	// Board-only single items cannot stack or fall back to passive storage. Count
	// claimed cells before sorting locations or allocating spawn identities.
	yield* assertBoardOnlyCapacityFx({
		drop,
		excludedLocations,
		item,
		origin,
		runtime,
	});

	const config = yield* GameConfigFx;
	const route = readPlacementRouteFn({
		itemScope: item.scope,
		originScope: origin.scope,
		toolbarEnabled: (config.meta.toolbarSize ?? 0) > 0,
	});
	const plans: PlacementPlan[] = [];
	let remainingQuantity = drop.quantity;
	let unavailableReason = route[0].unavailableReason;
	for (const step of route) {
		unavailableReason = step.unavailableReason;
		const plan = yield* planConcreteScopePlacementFx({
			drop,
			excludedLocations,
			item,
			origin,
			quantity: remainingQuantity,
			runtime,
			scope: step.scope,
		});
		plans.push(plan);
		remainingQuantity -= readPlacementPlanQuantityFn({
			plan,
		});
		if (remainingQuantity === 0) break;
	}

	return yield* assertPlacementPlanCompleteFx({
		drop,
		plan: mergePlacementPlansFn({
			plans,
		}),
		quantity: drop.quantity,
		reason: unavailableReason,
	});
});

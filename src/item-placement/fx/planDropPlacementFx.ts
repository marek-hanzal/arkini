import { Effect } from "effect";
import { match } from "ts-pattern";

import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { PositionSchema } from "~/item-location/schema/PositionSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { orderGridLocationsFn } from "~/item-placement/fn/orderGridLocationsFn";
import { readToolbarLocationsFn } from "~/item-placement/fn/readToolbarLocationsFn";
import type { dropFx } from "~/production-output/fx/dropFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";
import type { PlacementPlan } from "~/item-placement/PlacementPlan";

import { readPlacementPlanQuantityFn } from "../fn/readPlacementPlanQuantityFn";
import { assertPlacementPlanCompleteFx } from "./assertPlacementPlanCompleteFx";
import { assertPlacementMaxCountFx } from "./assertPlacementMaxCountFx";
import { planBoardPlacementFx } from "./planBoardPlacementFx";
import { planInventoryPlacementFx } from "./planInventoryPlacementFx";
import { planScopePlacementFx } from "./planScopePlacementFx";

interface PlanDropPlacementProps {
	readonly drop: dropFx.Result;
	readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
	readonly origin: GridLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

interface DropScopePlacementProps {
	readonly drop: dropFx.Result;
	readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
	readonly item: ItemSchema.Type;
	readonly quantity: PositiveIntegerSchema.Type;
	readonly runtime: RuntimeSchema.Type;
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

const planBoardThenStoragePlacementFx = Effect.fn("planBoardThenStoragePlacementFx")(function* ({
	drop,
	excludedLocations,
	item,
	origin,
	quantity,
	runtime,
}: DropScopePlacementProps & {
	readonly origin: BoardLocationSchema.Type;
}) {
	const boardPlan = yield* planBoardPlacementFx({
		excludedLocations: excludedLocations?.filter(
			(location): location is BoardLocationSchema.Type => location.scope === "board",
		),
		item,
		origin,
		placement: drop.placement,
		quantity,
		runtime,
	});
	const boardQuantity = readPlacementPlanQuantityFn({
		plan: boardPlan,
	});
	const inventoryQuantity = quantity - boardQuantity;
	if (inventoryQuantity === 0) return boardPlan;

	const inventoryPlan = yield* planInventoryPlacementFx({
		excludedLocations,
		item,
		quantity: inventoryQuantity,
		runtime,
	});
	const placedInventoryQuantity = readPlacementPlanQuantityFn({
		plan: inventoryPlan,
	});
	const toolbarQuantity = inventoryQuantity - placedInventoryQuantity;
	if (toolbarQuantity === 0) {
		return mergePlacementPlansFn({
			plans: [
				boardPlan,
				inventoryPlan,
			],
		});
	}

	const config = yield* GameConfigFx;
	if ((config.meta.toolbarSize ?? 0) === 0) {
		const plan = mergePlacementPlansFn({
			plans: [
				boardPlan,
				inventoryPlan,
			],
		});
		return yield* assertPlacementPlanCompleteFx({
			drop,
			plan,
			quantity,
			reason: PlacementUnavailableError.Reason.InventoryFull,
		});
	}

	const toolbarPlan = yield* planToolbarPlacementFx({
		excludedLocations,
		item,
		quantity: toolbarQuantity,
		runtime,
	});
	const plan = mergePlacementPlansFn({
		plans: [
			boardPlan,
			inventoryPlan,
			toolbarPlan,
		],
	});
	return yield* assertPlacementPlanCompleteFx({
		drop,
		plan,
		quantity,
		reason: PlacementUnavailableError.Reason.ToolbarFull,
	});
});

const planPassiveStoragePlacementFx = Effect.fn("planPassiveStoragePlacementFx")(function* ({
	drop,
	excludedLocations,
	item,
	origin,
	quantity,
	runtime,
}: DropScopePlacementProps & {
	readonly origin: Extract<
		GridLocationSchema.Type,
		{
			scope: "inventory" | "toolbar";
		}
	>;
}) {
	const first =
		origin.scope === "inventory"
			? yield* planInventoryPlacementFx({
					excludedLocations,
					item,
					origin: origin.position,
					quantity,
					runtime,
				})
			: yield* planToolbarPlacementFx({
					excludedLocations,
					item,
					origin: origin.position,
					quantity,
					runtime,
				});
	const firstQuantity = readPlacementPlanQuantityFn({
		plan: first,
	});
	const remainingQuantity = quantity - firstQuantity;
	if (remainingQuantity === 0) return first;

	const second =
		origin.scope === "inventory"
			? yield* planToolbarPlacementFx({
					excludedLocations,
					item,
					quantity: remainingQuantity,
					runtime,
				})
			: yield* planInventoryPlacementFx({
					excludedLocations,
					item,
					quantity: remainingQuantity,
					runtime,
				});
	const plan = mergePlacementPlansFn({
		plans: [
			first,
			second,
		],
	});
	return yield* assertPlacementPlanCompleteFx({
		drop,
		plan,
		quantity,
		reason:
			origin.scope === "inventory"
				? PlacementUnavailableError.Reason.ToolbarFull
				: PlacementUnavailableError.Reason.InventoryFull,
	});
});

const planDropScopePlacementFx = Effect.fn("planDropScopePlacementFx")(function* ({
	drop,
	excludedLocations,
	item,
	origin,
	quantity,
	runtime,
}: DropScopePlacementProps & {
	readonly origin: GridLocationSchema.Type;
}) {
	return yield* match(item.scope)
		.with(StorageSchema.enum.Board, () => {
			return Effect.gen(function* () {
				if (origin.scope !== "board") {
					return yield* assertPlacementPlanCompleteFx({
						drop,
						plan: {
							remove: [],
							spawn: [],
							stack: [],
						},
						quantity,
						reason: PlacementUnavailableError.Reason.BoardOriginUnavailable,
					});
				}
				const plan = yield* planBoardPlacementFx({
					excludedLocations: excludedLocations?.filter(
						(location): location is BoardLocationSchema.Type =>
							location.scope === "board",
					),
					item,
					origin,
					placement: drop.placement,
					quantity,
					runtime,
				});

				return yield* assertPlacementPlanCompleteFx({
					drop,
					plan,
					quantity,
					reason: PlacementUnavailableError.Reason.BoardFull,
				});
			});
		})
		.with(StorageSchema.enum.Inventory, () => {
			return Effect.gen(function* () {
				const plan = yield* planInventoryPlacementFx({
					excludedLocations,
					item,
					origin: origin.scope === "inventory" ? origin.position : undefined,
					quantity,
					runtime,
				});

				return yield* assertPlacementPlanCompleteFx({
					drop,
					plan,
					quantity,
					reason: PlacementUnavailableError.Reason.InventoryFull,
				});
			});
		})
		.with(StorageSchema.enum.Toolbar, () => {
			return Effect.gen(function* () {
				const plan = yield* planToolbarPlacementFx({
					excludedLocations,
					item,
					origin: origin.scope === "toolbar" ? origin.position : undefined,
					quantity,
					runtime,
				});

				return yield* assertPlacementPlanCompleteFx({
					drop,
					plan,
					quantity,
					reason: PlacementUnavailableError.Reason.ToolbarFull,
				});
			});
		})
		.with(StorageSchema.enum.Any, () => {
			return origin.scope === "board"
				? planBoardThenStoragePlacementFx({
						drop,
						excludedLocations,
						item,
						origin,
						quantity,
						runtime,
					})
				: planPassiveStoragePlacementFx({
						drop,
						excludedLocations,
						item,
						origin,
						quantity,
						runtime,
					});
		})
		.exhaustive();
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
	yield* assertPlacementMaxCountFx({
		drop,
		item,
		runtime,
	});

	return yield* planDropScopePlacementFx({
		drop,
		excludedLocations,
		item,
		origin,
		quantity: drop.quantity,
		runtime,
	});
});

import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import type { DropResultSchema } from "~/v1/output/schema/DropResultSchema";
import { PlacementUnavailableError } from "~/v1/placement/error/PlacementUnavailableError";
import type { PlacementFailureReasonEnumSchema } from "~/v1/placement/schema/PlacementFailureReasonEnumSchema";
import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { applyPlacementPlanFx } from "./applyPlacementPlanFx";
import { mergePlacementPlansFx } from "./mergePlacementPlansFx";
import { orderBoardLocationsFx } from "./orderBoardLocationsFx";
import { planScopePlacementFx } from "./planScopePlacementFx";
import { planSpawnPlacementFx } from "./planSpawnPlacementFx";
import { readEmptyLocationsFx } from "./readEmptyLocationsFx";
import { readGridLocationsFx } from "./readGridLocationsFx";
import { readPlacementPlanQuantityFx } from "./readPlacementPlanQuantityFx";
import { GameConfigFx } from "~/v1/game/context/GameConfigFx";

export namespace planDropPlacementFx {
	export interface Props {
		drop: DropResultSchema.Type;
		origin: PositionSchema.Type;
		originItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

const readPlacedQuantityFx = (plan: PlacementPlanSchema.Type) => {
	return readPlacementPlanQuantityFx({
		plan,
	});
};

const failPlacementFx = ({
	drop,
	reason,
	remainingQuantity,
}: {
	drop: DropResultSchema.Type;
	reason: PlacementFailureReasonEnumSchema.Type;
	remainingQuantity: number;
}) => {
	return Effect.fail(
		new PlacementUnavailableError({
			itemId: drop.itemId,
			placement: drop.placement,
			quantity: drop.quantity,
			reason,
			remainingQuantity,
		}),
	);
};

/**
 * Builds one complete all-or-nothing placement plan for a resolved drop.
 */
export const planDropPlacementFx = Effect.fn("planDropPlacementFx")(function* ({
	drop,
	origin,
	originItemId,
	runtime,
}: planDropPlacementFx.Props) {
	const config = yield* GameConfigFx;
	const item = yield* resolveItemFx({
		itemId: drop.itemId,
	});
	const replace = drop.placement === "replace";
	const originItem = replace
		? runtime.items.find((candidate) => candidate.id === originItemId)
		: undefined;
	if (replace && originItem === undefined) {
		return yield* Effect.fail(
			new ItemNotFoundError({
				itemId: originItemId,
			}),
		);
	}
	if (originItem !== undefined && originItem.location.scope !== "board") {
		return yield* failPlacementFx({
			drop,
			reason: "replace:origin-not-board",
			remainingQuantity: drop.quantity,
		});
	}
	if (replace && item.scope === "inventory") {
		return yield* failPlacementFx({
			drop,
			reason: "replace:board-forbidden",
			remainingQuantity: drop.quantity,
		});
	}

	const removePlan = {
		remove: replace
			? [
					originItemId,
				]
			: [],
		spawn: [],
		stack: [],
	} satisfies PlacementPlanSchema.Type;
	const [, runtimeAfterRemove] = yield* applyPlacementPlanFx({
		plan: removePlan,
		runtime,
	});
	const existingQuantity = runtimeAfterRemove.items.reduce((quantity, candidate) => {
		return candidate.item.id === item.id ? quantity + candidate.quantity : quantity;
	}, 0);
	if (item.maxCount !== undefined && existingQuantity + drop.quantity > item.maxCount) {
		return yield* failPlacementFx({
			drop,
			reason: "item:max-count",
			remainingQuantity: existingQuantity + drop.quantity - item.maxCount,
		});
	}

	let draft = runtimeAfterRemove;
	let remainingQuantity = drop.quantity;
	const plans: PlacementPlanSchema.Type[] = [
		removePlan,
	];

	if (replace) {
		const replacementSpawn = yield* planSpawnPlacementFx({
			item,
			locations: [
				{
					position: origin,
					scope: "board",
				},
			],
			quantity: remainingQuantity,
		});
		const replacementPlan = {
			remove: [],
			spawn: replacementSpawn,
			stack: [],
		} satisfies PlacementPlanSchema.Type;
		plans.push(replacementPlan);
		const placedQuantity = yield* readPlacedQuantityFx(replacementPlan);
		remainingQuantity -= placedQuantity;
		[, draft] = yield* applyPlacementPlanFx({
			plan: replacementPlan,
			runtime: draft,
		});
	}

	const boardAllowed = item.scope === "board" || item.scope === "any";
	if (remainingQuantity > 0 && boardAllowed) {
		const boardLocations = yield* readGridLocationsFx({
			scope: "board",
			size: config.meta.board,
		});
		const emptyBoardLocations = yield* readEmptyLocationsFx({
			locations: boardLocations,
			runtime: draft,
		});
		const orderedBoardLocations = yield* orderBoardLocationsFx({
			locations: emptyBoardLocations,
			origin,
			placement: match(drop.placement)
				.with("random", () => "random" as const)
				.otherwise(() => "drop" as const),
		});
		const boardPlan = yield* planScopePlacementFx({
			item,
			locations: orderedBoardLocations,
			origin: drop.placement === "random" ? undefined : origin,
			quantity: remainingQuantity,
			runtime: draft,
			scope: "board",
		});
		plans.push(boardPlan);
		const placedQuantity = yield* readPlacedQuantityFx(boardPlan);
		remainingQuantity -= placedQuantity;
		[, draft] = yield* applyPlacementPlanFx({
			plan: boardPlan,
			runtime: draft,
		});
	}

	const inventoryAllowed = item.scope === "inventory" || item.scope === "any";
	if (remainingQuantity > 0 && inventoryAllowed) {
		const inventoryLocations = yield* readGridLocationsFx({
			scope: "inventory",
			size: config.meta.inventory,
		});
		const inventoryPlan = yield* planScopePlacementFx({
			item,
			locations: inventoryLocations,
			quantity: remainingQuantity,
			runtime: draft,
			scope: "inventory",
		});
		plans.push(inventoryPlan);
		const placedQuantity = yield* readPlacedQuantityFx(inventoryPlan);
		remainingQuantity -= placedQuantity;
		[, draft] = yield* applyPlacementPlanFx({
			plan: inventoryPlan,
			runtime: draft,
		});
	}

	if (remainingQuantity > 0) {
		return yield* failPlacementFx({
			drop,
			reason: inventoryAllowed ? "inventory:full" : "board:full",
			remainingQuantity,
		});
	}

	return yield* mergePlacementPlansFx({
		plans,
	});
});

import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { DropResultSchema } from "~/v1/output/schema/DropResultSchema";
import { PlacementUnavailableError } from "~/v1/placement/error/PlacementUnavailableError";
import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { planSpawnPlacementFx } from "./planSpawnPlacementFx";

export namespace planReplacePlacementFx {
	export interface Props {
		drop: DropResultSchema.Type;
		item: ItemSchema.Type;
		origin: PositionSchema.Type;
		originItemId: IdSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Plans exact removal and replacement of one board origin item.
 */
export const planReplacePlacementFx = Effect.fn("planReplacePlacementFx")(function* ({
	drop,
	item,
	origin,
	originItemId,
	quantity,
	runtime,
}: planReplacePlacementFx.Props) {
	const originItem = runtime.items.find((candidate) => candidate.id === originItemId);
	if (originItem === undefined) {
		return yield* Effect.fail(
			new ItemNotFoundError({
				itemId: originItemId,
			}),
		);
	}
	if (originItem.location.scope !== "board") {
		return yield* Effect.fail(
			new PlacementUnavailableError({
				itemId: drop.itemId,
				placement: drop.placement,
				quantity: drop.quantity,
				reason: "replace:origin-not-board",
				remainingQuantity: quantity,
			}),
		);
	}
	if (item.scope === "inventory") {
		return yield* Effect.fail(
			new PlacementUnavailableError({
				itemId: drop.itemId,
				placement: drop.placement,
				quantity: drop.quantity,
				reason: "replace:board-forbidden",
				remainingQuantity: quantity,
			}),
		);
	}

	const spawn = yield* planSpawnPlacementFx({
		item,
		locations: [
			{
				position: origin,
				scope: "board",
			},
		],
		quantity,
	});

	return {
		remove: [
			originItemId,
		],
		spawn,
		stack: [],
	} satisfies PlacementPlanSchema.Type;
});

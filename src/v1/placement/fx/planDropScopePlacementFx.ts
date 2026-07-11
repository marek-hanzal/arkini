import { Effect } from "effect";
import { match } from "ts-pattern";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { DropResultSchema } from "~/v1/output/schema/DropResultSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { assertPlacementPlanCompleteFx } from "./assertPlacementPlanCompleteFx";
import { planBoardThenInventoryPlacementFx } from "./planBoardThenInventoryPlacementFx";
import { planBoardPlacementFx } from "./planBoardPlacementFx";
import { planInventoryPlacementFx } from "./planInventoryPlacementFx";

export namespace planDropScopePlacementFx {
	export interface Props {
		drop: DropResultSchema.Type;
		item: ItemSchema.Type;
		origin: PositionSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Plans one drop remainder according to the canonical item's allowed runtime scope.
 */
export const planDropScopePlacementFx = Effect.fn("planDropScopePlacementFx")(function* ({
	drop,
	item,
	origin,
	quantity,
	runtime,
}: planDropScopePlacementFx.Props) {
	const boardPlacement = drop.placement === "random" ? "random" : "drop";

	return yield* match(item.scope)
		.with("board", () => {
			return Effect.gen(function* () {
				const plan = yield* planBoardPlacementFx({
					item,
					origin,
					placement: boardPlacement,
					quantity,
					runtime,
				});

				return yield* assertPlacementPlanCompleteFx({
					drop,
					plan,
					quantity,
					reason: "board:full",
				});
			});
		})
		.with("inventory", () => {
			return Effect.gen(function* () {
				const plan = yield* planInventoryPlacementFx({
					item,
					quantity,
					runtime,
				});

				return yield* assertPlacementPlanCompleteFx({
					drop,
					plan,
					quantity,
					reason: "inventory:full",
				});
			});
		})
		.with("any", () => {
			return planBoardThenInventoryPlacementFx({
				drop,
				item,
				origin,
				quantity,
				runtime,
			});
		})
		.exhaustive();
});

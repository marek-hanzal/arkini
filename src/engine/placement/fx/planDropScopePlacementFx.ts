import { Effect } from "effect";
import { match } from "ts-pattern";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { DropResultSchema } from "~/engine/output/schema/DropResultSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { assertPlacementPlanCompleteFx } from "./assertPlacementPlanCompleteFx";
import { planBoardPlacementFx } from "./planBoardPlacementFx";
import { planBoardThenStoragePlacementFx } from "./planBoardThenStoragePlacementFx";
import { planInventoryPlacementFx } from "./planInventoryPlacementFx";
import { planToolbarPlacementFx } from "./planToolbarPlacementFx";

export namespace planDropScopePlacementFx {
	export interface Props {
		drop: DropResultSchema.Type;
		item: ItemSchema.Type;
		origin: BoardLocationSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans one drop remainder according to the canonical item's allowed runtime scope. */
export const planDropScopePlacementFx = Effect.fn("planDropScopePlacementFx")(function* ({
	drop,
	item,
	origin,
	quantity,
	runtime,
}: planDropScopePlacementFx.Props) {
	return yield* match(item.scope)
		.with("board", () => {
			return Effect.gen(function* () {
				const plan = yield* planBoardPlacementFx({
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
		.with("toolbar", () => {
			return Effect.gen(function* () {
				const plan = yield* planToolbarPlacementFx({
					item,
					quantity,
					runtime,
				});

				return yield* assertPlacementPlanCompleteFx({
					drop,
					plan,
					quantity,
					reason: "toolbar:full",
				});
			});
		})
		.with("any", () => {
			return planBoardThenStoragePlacementFx({
				drop,
				item,
				origin,
				quantity,
				runtime,
			});
		})
		.exhaustive();
});

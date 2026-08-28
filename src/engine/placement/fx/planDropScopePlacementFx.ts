import { Effect } from "effect";
import { match } from "ts-pattern";

import { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { DropResultSchema } from "~/engine/output/schema/DropResultSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { StorageSchema } from "~/engine/scope/schema/StorageSchema";

import { assertPlacementPlanCompleteFx } from "./assertPlacementPlanCompleteFx";
import { planBoardPlacementFx } from "./planBoardPlacementFx";
import { planBoardThenStoragePlacementFx } from "./planBoardThenStoragePlacementFx";
import { planInventoryPlacementFx } from "./planInventoryPlacementFx";
import { planPassiveStoragePlacementFx } from "./planPassiveStoragePlacementFx";
import { planToolbarPlacementFx } from "./planToolbarPlacementFx";

export namespace planDropScopePlacementFx {
	export interface Props {
		drop: DropResultSchema.Type;
		excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
		item: ItemSchema.Type;
		origin: GridLocationSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans one drop remainder according to the canonical item's allowed runtime scope. */
export const planDropScopePlacementFx = Effect.fn("planDropScopePlacementFx")(function* ({
	drop,
	excludedLocations,
	item,
	origin,
	quantity,
	runtime,
}: planDropScopePlacementFx.Props) {
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
						reason: PlacementFailureReasonEnumSchema.enum.BoardOriginUnavailable,
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
					reason: PlacementFailureReasonEnumSchema.enum.BoardFull,
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
					reason: PlacementFailureReasonEnumSchema.enum.InventoryFull,
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
					reason: PlacementFailureReasonEnumSchema.enum.ToolbarFull,
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

import { Effect, Option } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { readTileActorBadgeCountFx } from "~/bridge/tile/readTileActorBadgeCountFx";
import { readTileActorPrimaryAssetIdFx } from "~/bridge/tile/readTileActorPrimaryAssetIdFx";
import { readTileActorVisualFx } from "~/bridge/tile/readTileActorVisualFx";
import { readEffectiveGridFootprintFx } from "~/engine/grid/fx/readEffectiveGridFootprintFx";
import type { GridSizeSchema } from "~/engine/grid/schema/GridSizeSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { isDeliveryRuntimeItemFx } from "~/engine/runtime/read/isDeliveryRuntimeItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface TileDelivery {
	readonly from: GridLocationSchema.Type;
	readonly fromFootprint: GridSizeSchema.Type;
	readonly generation: number;
	readonly item: TileActorItem;
	readonly phase: "outbound" | "returning";
	readonly targetActorId?: string;
	readonly to: GridLocationSchema.Type;
	readonly toFootprint: GridSizeSchema.Type;
}

export namespace readTileDeliveriesFx {
	export interface Props {
		readonly game: GameEngine;
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Projects canonical deliveries into main-scene motion facts.
 *
 * Inventory cells have no pose on the main canvas, so their live Inventory opener is the visible
 * portal. The engine still retains and settles the exact Inventory-cell lease.
 */
export const readTileDeliveriesFx = Effect.fnUntraced(function* ({
	game,
	runtime,
}: readTileDeliveriesFx.Props) {
	const inventoryOpener = runtime.items.find(
		(candidate) =>
			candidate.item.type === ItemEnumSchema.enum.Inventory &&
			(candidate.location.scope === LocationScopeEnumSchema.enum.Toolbar ||
				(candidate.location.scope === LocationScopeEnumSchema.enum.Board &&
					candidate.location.space === runtime.currentSpace)),
	);
	const inventoryOpenerLocation: GridLocationSchema.Type | undefined =
		inventoryOpener?.location.scope === LocationScopeEnumSchema.enum.Board ||
		inventoryOpener?.location.scope === LocationScopeEnumSchema.enum.Toolbar
			? inventoryOpener.location
			: undefined;
	const readPresentationLocation = (
		location: GridLocationSchema.Type,
	): GridLocationSchema.Type | undefined =>
		location.scope === LocationScopeEnumSchema.enum.Inventory
			? inventoryOpenerLocation
			: location;
	const deliveries: TileDelivery[] = [];

	for (const runtimeItem of runtime.items) {
		const delivery = yield* isDeliveryRuntimeItemFx(runtimeItem);
		if (Option.isNone(delivery)) continue;
		const current = delivery.value;
		const semanticFrom =
			current.location.phase === "outbound"
				? current.location.origin
				: current.location.returnFrom;
		let semanticTo: GridLocationSchema.Type | undefined;
		if (current.location.phase === "returning") {
			semanticTo = current.location.origin;
		} else {
			const ownerItemId = current.location.target.ownerItemId;
			const owner = runtime.items.find((candidate) => candidate.id === ownerItemId);
			if (
				owner?.location.scope === LocationScopeEnumSchema.enum.Board ||
				owner?.location.scope === LocationScopeEnumSchema.enum.Inventory ||
				owner?.location.scope === LocationScopeEnumSchema.enum.Toolbar
			) {
				semanticTo = owner.location;
			}
		}
		if (semanticTo === undefined) continue;
		const from = readPresentationLocation(semanticFrom);
		const to = readPresentationLocation(semanticTo);
		if (from === undefined || to === undefined) continue;
		const [fromFootprint, toFootprint] = yield* Effect.all([
			readEffectiveGridFootprintFx({
				authored: current.item.footprint,
				location: semanticFrom,
			}),
			readEffectiveGridFootprintFx({
				authored: current.item.footprint,
				location: semanticTo,
			}),
		]);
		const visibleOnMain = [
			from,
			to,
		].some(
			(location) =>
				location.scope === LocationScopeEnumSchema.enum.Toolbar ||
				(location.scope === LocationScopeEnumSchema.enum.Board &&
					location.space === runtime.currentSpace),
		);
		if (!visibleOnMain) continue;

		const visual = yield* readTileActorVisualFx({
			game,
			item: current.item,
			primaryAssetId: yield* readTileActorPrimaryAssetIdFx({
				item: current,
				runtime,
			}),
		});
		const badgeCount = yield* readTileActorBadgeCountFx(current);
		deliveries.push({
			from,
			fromFootprint,
			generation: current.location.generation,
			item: {
				...visual,
				...(badgeCount === undefined
					? {}
					: {
							badgeCount,
						}),
				id: current.id,
				footprint: yield* readEffectiveGridFootprintFx({
					authored: current.item.footprint,
					location: semanticFrom,
				}),
				itemType: current.item.type,
				revision: current.revision,
				quantity: current.quantity,
				location: from,
				running: false,
				activityEffect: false,
				primaryAction: {
					kind: "none",
				},
			},
			phase: current.location.phase,
			...(current.location.phase === "outbound"
				? {
						targetActorId: current.location.target.ownerItemId,
					}
				: {}),
			to,
			toFootprint,
		});
	}

	return deliveries;
});

import { Effect, Option } from "effect";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { readTileActorBadgeCountFn } from "~/tile-presentation/fn/readTileActorBadgeCountFn";
import { readTileActorAssetSourceIdsFn } from "~/tile-presentation/fn/readTileActorAssetSourceIdsFn";
import { readTileActorVisualFx } from "~/tile-presentation/fx/readTileActorVisualFx";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { narrowDeliveryRuntimeItemFn } from "~/game-runtime/fn/narrowDeliveryRuntimeItemFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export interface TileDelivery {
	readonly from: GridLocationSchema.Type;
	readonly generation: number;
	readonly item: TileActorItem;
	readonly phase: "outbound" | "returning";
	readonly remainingDurationMs: number;
	readonly targetActorId?: string;
	readonly to: GridLocationSchema.Type;
}

interface ReadTileDeliveriesProps {
	readonly game: GameEngine;
	readonly runtime: RuntimeSchema.Type;
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
}: ReadTileDeliveriesProps) {
	const inventoryOpener = runtime.items.find(
		(candidate) =>
			candidate.item.type === TypeSchema.enum.Inventory &&
			(candidate.location.scope === LocationScopeEnumSchema.enum.Toolbar ||
				(candidate.location.scope === LocationScopeEnumSchema.enum.Board &&
					candidate.location.space === runtime.currentSpace)),
	);
	const inventoryOpenerLocation: GridLocationSchema.Type | undefined =
		inventoryOpener?.location.scope === LocationScopeEnumSchema.enum.Board ||
		inventoryOpener?.location.scope === LocationScopeEnumSchema.enum.Toolbar
			? inventoryOpener.location
			: undefined;
	const readPresentationLocationFn = (
		location: GridLocationSchema.Type,
	): GridLocationSchema.Type | undefined =>
		location.scope === LocationScopeEnumSchema.enum.Inventory
			? inventoryOpenerLocation
			: location;
	const deliveries: TileDelivery[] = [];

	for (const runtimeItem of runtime.items) {
		const delivery = narrowDeliveryRuntimeItemFn(runtimeItem);
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
		const from = readPresentationLocationFn(semanticFrom);
		const to = readPresentationLocationFn(semanticTo);
		if (from === undefined || to === undefined) continue;
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
			sourceIds: readTileActorAssetSourceIdsFn({
				item: current,
				runtime,
			}),
		});
		const badgeCount = readTileActorBadgeCountFn(current);
		deliveries.push({
			from,
			generation: current.location.generation,
			item: {
				...visual,
				...(badgeCount === undefined
					? {}
					: {
							badgeCount,
						}),
				id: current.id,
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
			remainingDurationMs: current.location.remainingDurationMs,
			...(current.location.phase === "outbound"
				? {
						targetActorId: current.location.target.ownerItemId,
					}
				: {}),
			to,
		});
	}

	return deliveries;
});

import { Effect, Option } from "effect";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { readTileActorBadgeCountFn } from "~/tile-presentation/fn/readTileActorBadgeCountFn";
import { readTileActorVisualFx } from "~/tile-presentation/fx/readTileActorVisualFx";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { narrowDeliveryRuntimeItemFn } from "~/game-runtime/fn/narrowDeliveryRuntimeItemFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export interface TileDelivery {
	readonly from: BoardLocationSchema.Type;
	readonly generation: number;
	readonly item: TileActorItem;
	readonly phase: "outbound" | "returning";
	readonly remainingDurationMs: number;
	readonly targetActorId?: string;
	readonly to: BoardLocationSchema.Type;
}

interface ReadTileDeliveriesProps {
	readonly game: GameEngine;
	readonly runtime: RuntimeSchema.Type;
}

/** Projects canonical deliveries into main-scene motion facts. */
export const readTileDeliveriesFx = Effect.fnUntraced(function* ({
	game,
	runtime,
}: ReadTileDeliveriesProps) {
	const deliveries: TileDelivery[] = [];

	for (const runtimeItem of runtime.items) {
		const delivery = narrowDeliveryRuntimeItemFn(runtimeItem);
		if (Option.isNone(delivery)) continue;
		const current = delivery.value;
		const semanticFrom =
			current.location.phase === "outbound"
				? current.location.origin
				: current.location.returnFrom;
		let semanticTo: BoardLocationSchema.Type | undefined;
		if (current.location.phase === "returning") {
			semanticTo = current.location.origin;
		} else {
			const ownerItemId = current.location.target.ownerItemId;
			const owner = runtime.items.find((candidate) => candidate.id === ownerItemId);
			if (owner?.location.scope === LocationScopeEnumSchema.enum.Board) {
				semanticTo = owner.location;
			}
		}
		if (semanticTo === undefined) continue;
		const from = semanticFrom;
		const to = semanticTo;
		const visibleOnMain = [
			from,
			to,
		].some(
			(location) =>
				location.scope === LocationScopeEnumSchema.enum.Board &&
				location.space === runtime.currentSpace,
		);
		if (!visibleOnMain) continue;

		const visual = yield* readTileActorVisualFx({
			game,
			item: current.item,
		});
		const badgeCount = readTileActorBadgeCountFn(current);
		deliveries.push({
			from,
			generation: current.location.generation,
			item: {
				...visual,
				...(current.item.units === undefined
					? {}
					: {
							badgeKind: "units" as const,
						}),
				...(badgeCount === undefined
					? {}
					: {
							badgeCount,
						}),
				id: current.id,
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

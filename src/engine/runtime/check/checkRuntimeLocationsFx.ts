import { Effect } from "effect";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { match } from "ts-pattern";

import { readGridLocationOccupantsFx } from "~/engine/location/read/readGridLocationOccupantsFx";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { LocationOccupiedIssueSchema } from "~/engine/runtime/schema/check/LocationOccupiedIssueSchema";
import type { LocationOutOfBoundsIssueSchema } from "~/engine/runtime/schema/check/LocationOutOfBoundsIssueSchema";
import type { LocationScopeIssueSchema } from "~/engine/runtime/schema/check/LocationScopeIssueSchema";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace checkRuntimeLocationsFx {
	export interface Props {
		config: GameConfigSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Reports every violation of the item-owned grid-location contract.
 *
 * Rules are intentionally spelled out here instead of hidden in schema
 * refinements: canonical scope, configured grid bounds, and unique occupancy.
 * Line-input locations are validated by the input runtime checker.
 */
export const checkRuntimeLocationsFx = Effect.fn("checkRuntimeLocationsFx")(function* ({
	config,
	runtime,
}: checkRuntimeLocationsFx.Props) {
	const items = runtime.items.filter(isGridRuntimeItem);
	const scopeIssues: LocationScopeIssueSchema.Type[] = [];
	const boundsIssues: LocationOutOfBoundsIssueSchema.Type[] = [];
	const occupancyIssues: LocationOccupiedIssueSchema.Type[] = [];

	for (const item of items) {
		const configuredScope = item.item.scope;
		const scopeAllowed = configuredScope === StorageScopeEnumSchema.enum.any || configuredScope === item.location.scope;
		if (!scopeAllowed) {
			scopeIssues.push({
				configuredScope,
				itemId: item.id,
				location: item.location,
				type: RuntimeCheckIssueEnumSchema.enum.LocationScope,
			});
		}

		const size = match(item.location.scope)
			.with(LocationScopeEnumSchema.enum.Board, () => config.meta.board)
			.with(LocationScopeEnumSchema.enum.Inventory, () => config.meta.inventory)
			.with(LocationScopeEnumSchema.enum.Toolbar, () => ({
				width: config.meta.toolbarSize ?? 0,
				height: 1,
			}))
			.exhaustive();
		const insideBounds =
			item.location.position.x < size.width && item.location.position.y < size.height;
		if (!insideBounds) {
			boundsIssues.push({
				itemId: item.id,
				location: item.location,
				size,
				type: RuntimeCheckIssueEnumSchema.enum.LocationOutOfBounds,
			});
		}
	}

	const occupants = yield* readGridLocationOccupantsFx({
		items,
		locations: items.map((item) => item.location),
	});
	for (const entry of occupants) {
		if (entry.items.length <= 1) continue;
		occupancyIssues.push({
			itemIds: entry.items.map((item) => item.id),
			location: entry.location,
			type: RuntimeCheckIssueEnumSchema.enum.LocationOccupied,
		});
	}

	return [
		...scopeIssues,
		...boundsIssues,
		...occupancyIssues,
	];
});

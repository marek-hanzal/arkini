import { Effect } from "effect";
import { match } from "ts-pattern";

import { isItemLocationScopeAllowedFx } from "~/engine/location/read/isItemLocationScopeAllowedFx";
import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { indexGridLocationClaimsFx } from "~/engine/location/read/indexGridLocationClaimsFx";
import { readGridLocationClaimsFx } from "~/engine/location/read/readGridLocationClaimsFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { LocationOccupiedIssueSchema } from "~/engine/runtime/schema/check/LocationOccupiedIssueSchema";
import type { LocationOutOfBoundsIssueSchema } from "~/engine/runtime/schema/check/LocationOutOfBoundsIssueSchema";
import type { LocationScopeIssueSchema } from "~/engine/runtime/schema/check/LocationScopeIssueSchema";
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
	const items: {
		readonly item: RuntimeItemSchema.Type;
		readonly location: GridLocationSchema.Type;
	}[] = [];
	for (const item of runtime.items) {
		if (
			item.location.scope === LocationScopeEnumSchema.enum.Board ||
			item.location.scope === LocationScopeEnumSchema.enum.Inventory ||
			item.location.scope === LocationScopeEnumSchema.enum.Toolbar
		) {
			items.push({
				item,
				location: item.location,
			});
		} else if (item.location.scope === LocationScopeEnumSchema.enum.Delivery) {
			items.push({
				item,
				location: item.location.origin,
			});
		}
	}
	const scopeIssues: LocationScopeIssueSchema.Type[] = [];
	const boundsIssues: LocationOutOfBoundsIssueSchema.Type[] = [];
	const occupancyIssues: LocationOccupiedIssueSchema.Type[] = [];

	for (const { item, location } of items) {
		const configuredScope = item.item.scope;
		const scopeAllowed = yield* isItemLocationScopeAllowedFx({
			item: item.item,
			locationScope: location.scope,
		});
		if (!scopeAllowed) {
			scopeIssues.push({
				configuredScope,
				itemId: item.id,
				location,
				type: RuntimeCheckIssueEnumSchema.enum.LocationScope,
			});
		}

		const size = match(location.scope)
			.with(LocationScopeEnumSchema.enum.Board, () => config.meta.board)
			.with(LocationScopeEnumSchema.enum.Inventory, () => config.meta.inventory)
			.with(LocationScopeEnumSchema.enum.Toolbar, () => ({
				width: config.meta.toolbarSize ?? 0,
				height: 1,
			}))
			.exhaustive();
		const insideBounds = location.position.x < size.width && location.position.y < size.height;
		if (!insideBounds) {
			boundsIssues.push({
				itemId: item.id,
				location,
				size,
				type: RuntimeCheckIssueEnumSchema.enum.LocationOutOfBounds,
			});
		}
	}

	const claimsByLocation = yield* indexGridLocationClaimsFx(
		yield* readGridLocationClaimsFx({
			runtime,
		}),
	);
	for (const claims of claimsByLocation.values()) {
		if (claims.length <= 1) continue;
		const first = claims[0];
		if (first === undefined) continue;
		occupancyIssues.push({
			itemIds: claims.map((claim) => claim.itemId),
			location: first.location,
			type: RuntimeCheckIssueEnumSchema.enum.LocationOccupied,
		});
	}

	return [
		...scopeIssues,
		...boundsIssues,
		...occupancyIssues,
	];
});

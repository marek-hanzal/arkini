import { Effect } from "effect";
import { match } from "ts-pattern";

import { isSameGridLocation } from "~/v1/location/read/isSameGridLocation";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { LocationOccupiedIssueSchema } from "~/v1/runtime/schema/check/LocationOccupiedIssueSchema";
import type { LocationOutOfBoundsIssueSchema } from "~/v1/runtime/schema/check/LocationOutOfBoundsIssueSchema";
import type { LocationScopeIssueSchema } from "~/v1/runtime/schema/check/LocationScopeIssueSchema";

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
		const scopeAllowed = configuredScope === "any" || configuredScope === item.location.scope;
		if (!scopeAllowed) {
			scopeIssues.push({
				configuredScope,
				itemId: item.id,
				location: item.location,
				type: "location:scope",
			});
		}

		const size = match(item.location.scope)
			.with("board", () => config.meta.board)
			.with("inventory", () => config.meta.inventory)
			.exhaustive();
		const insideBounds =
			item.location.position.x < size.width && item.location.position.y < size.height;
		if (!insideBounds) {
			boundsIssues.push({
				itemId: item.id,
				location: item.location,
				size,
				type: "location:out-of-bounds",
			});
		}
	}

	for (const [index, item] of items.entries()) {
		const alreadyReported = occupancyIssues.some((issue) =>
			isSameGridLocation(issue.location, item.location),
		);
		if (alreadyReported) {
			continue;
		}

		const occupants = items
			.slice(index)
			.filter((candidate) => isSameGridLocation(candidate.location, item.location));
		if (occupants.length > 1) {
			occupancyIssues.push({
				itemIds: occupants.map((occupant) => occupant.id),
				location: item.location,
				type: "location:occupied",
			});
		}
	}

	return [
		...scopeIssues,
		...boundsIssues,
		...occupancyIssues,
	];
});

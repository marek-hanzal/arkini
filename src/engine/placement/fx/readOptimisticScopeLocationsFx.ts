import { Effect } from "effect";

import { readGridLocationClaimsFx } from "~/engine/location/read/readGridLocationClaimsFx";
import { readGridLocationKey } from "~/engine/location/read/readGridLocationOccupantsFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

type GridLocationScope = GridLocationSchema.Type["scope"];

const belongsToScope = ({
	location,
	originSpace,
	scope,
}: {
	readonly location: GridLocationSchema.Type;
	readonly originSpace: number;
	readonly scope: GridLocationScope;
}) =>
	location.scope === scope &&
	(location.scope !== LocationScopeEnumSchema.enum.Board || location.space === originSpace);

export namespace readOptimisticScopeLocationsFx {
	export interface Props {
		readonly count: number;
		readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
		readonly originSpace: number;
		readonly runtime: RuntimeSchema.Type;
		readonly scope: GridLocationScope;
	}
}

/**
 * Reads stack candidates and appends deterministic unbounded cells for one scope.
 *
 * Existing claims remain visible so canonical stack and purity behavior is reused.
 * New cells begin after the largest claimed or excluded x coordinate and may sit
 * outside authored grid dimensions; they are valid only inside planner snapshots.
 */
export const readOptimisticScopeLocationsFx = Effect.fn("readOptimisticScopeLocationsFx")(
	function* ({
		count,
		excludedLocations = [],
		originSpace,
		runtime,
		scope,
	}: readOptimisticScopeLocationsFx.Props) {
		const claimedLocations = (yield* readGridLocationClaimsFx({
			runtime,
		}))
			.map(({ location }) => location)
			.filter((location) =>
				belongsToScope({
					location,
					originSpace,
					scope,
				}),
			)
			.sort((left, right) =>
				readGridLocationKey(left).localeCompare(readGridLocationKey(right)),
			);
		const relevantExcludedLocations = excludedLocations
			.filter((location) =>
				belongsToScope({
					location,
					originSpace,
					scope,
				}),
			)
			.sort((left, right) =>
				readGridLocationKey(left).localeCompare(readGridLocationKey(right)),
			);
		const blockedLocations = [
			...claimedLocations,
			...relevantExcludedLocations,
		];
		const blocked = new Set(blockedLocations.map(readGridLocationKey));
		let x = blockedLocations.reduce(
			(maximum, location) => Math.max(maximum, location.position.x + 1),
			0,
		);
		const virtualLocations: GridLocationSchema.Type[] = [];
		while (virtualLocations.length < count) {
			const location: GridLocationSchema.Type =
				scope === LocationScopeEnumSchema.enum.Board
					? {
							scope,
							space: originSpace,
							position: {
								x,
								y: 0,
							},
						}
					: {
							scope,
							position: {
								x,
								y: 0,
							},
						};
			x += 1;
			const key = readGridLocationKey(location);
			if (blocked.has(key)) continue;
			blocked.add(key);
			virtualLocations.push(location);
		}

		return {
			claimedLocations,
			excludedLocations: relevantExcludedLocations,
			virtualLocations,
		};
	},
);

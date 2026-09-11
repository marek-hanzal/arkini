import { match } from "ts-pattern";

import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import { readGridLocationKeyFn } from "~/item-location/fn/readGridLocationKeyFn";
import type { NeighborhoodArtworkRuleSchema } from "~/item-definition/schema/NeighborhoodArtworkRuleSchema";

const offsets = [
	[
		"nw",
		-1,
		-1,
	],
	[
		"n",
		0,
		-1,
	],
	[
		"ne",
		1,
		-1,
	],
	[
		"w",
		-1,
		0,
	],
	[
		"e",
		1,
		0,
	],
	[
		"sw",
		-1,
		1,
	],
	[
		"s",
		0,
		1,
	],
	[
		"se",
		1,
		1,
	],
] as const;

/**
 * Resolves first-match artwork from committed occupants in one pass. Artwork is
 * never an input: visual changes cannot cascade, and delivery leases are not items.
 */
export const readNeighborhoodArtworkFn = (
	items: ReadonlyArray<RuntimeItemSchema.Type>,
): ReadonlyMap<string, string> => {
	const occupants = new Map<string, string>();
	for (const { item, location } of items) {
		if (location.scope !== "board") continue;
		occupants.set(readGridLocationKeyFn(location, item.layer), item.id);
	}
	const artwork = new Map<string, string>();
	for (const { id, item, location } of items) {
		if (location.scope !== "board" || item.asset.neighbors === undefined) continue;
		const neighbors = offsets.map(([direction, dx, dy]) => ({
			direction,
			itemId: occupants.get(
				readGridLocationKeyFn(
					{
						...location,
						position: {
							x: location.position.x + dx,
							y: location.position.y + dy,
						},
					},
					item.layer,
				),
			),
		}));
		const rule = item.asset.neighbors.find(({ neighbors: conditions }) =>
			neighbors.every(({ direction, itemId }) =>
				matchesNeighborFn(conditions[direction], itemId),
			),
		);
		if (rule !== undefined) artwork.set(id, rule.sourceId);
	}
	return artwork;
};

const matchesNeighborFn = (
	condition: NeighborhoodArtworkRuleSchema.Type["neighbors"]["n"],
	itemId: string | undefined,
) =>
	match(condition)
		.with(
			{
				type: "ignore",
			},
			() => true,
		)
		.with(
			{
				type: "empty",
			},
			() => itemId === undefined,
		)
		.with(
			{
				type: "filled",
			},
			() => itemId !== undefined,
		)
		.with(
			{
				type: "item",
			},
			(condition) => itemId === condition.itemId,
		)
		.exhaustive();

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { DistanceSchema } from "~/item-location/schema/DistanceSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { LocationSchema } from "~/item-location/schema/LocationSchema";
import { queryFx } from "~/item-query/fx/queryFx";
import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:query-test",
		title: "Query test",
		board: {
			width: 10,
			height: 10,
		},
	},
	start: {
		currentSpace: 0,
	},
	items: {
		tree: {
			maxQueueSize: 1,
			lines: [],

			uid: "tree",
			id: "tree",
			title: "Tree",
			description: "A living tree.",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:tree",
				],
			},
		},
	},
});

const item = (id: string, location: LocationSchema.Type): RuntimeItemSchema.Type => ({
	id,
	item: config.items.tree,
	location,
	revision: `revision:${id}`,
});

const board = (id: string, space: number, x: number, y = 0) =>
	item(id, {
		scope: "board",
		space,
		position: {
			x,
			y,
		},
	});

const runtime = ({
	currentSpace = 0,
	items,
}: {
	readonly currentSpace?: number;
	readonly items: RuntimeSchema.Type["items"];
}): RuntimeSchema.Type => ({
	cheats: {
		enabled: false,
		everEnabled: false,
		speedUpGameplay: false,
	},
	currentSpace,
	items,
	jobs: [],
	jobQueue: [],
	defaultLineByOwnerItemId: {},
});

const origin = {
	scope: "board",
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
} as const;

const selector = {
	itemId: "tree",
	type: "item",
} as const;

const runQuery = ({
	query,
	runtime,
	queryOrigin = origin,
}: {
	readonly query: QuerySchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly queryOrigin?: BoardLocationSchema.Type;
}) =>
	queryFx({
		origin: queryOrigin,
		query,
	}).pipe(
		Effect.provideService(RuntimeFx, {
			read: Effect.succeed(runtime),
		}),
	);

const readIds = (items: ReadonlyArray<RuntimeItemSchema.Type>) => items.map(({ id }) => id);

describe("queryFx", () => {
	it("combines Close and Near without Self or other Spaces and preserves exact rings and Far", () => {
		const snapshot = runtime({
			items: [
				board("origin", 0, 0),
				board("close", 0, 1),
				board("close-diagonal", 0, 1, 1),
				board("near", 0, 2),
				board("near-diagonal", 0, 2, 2),
				board("far", 0, 3),
				board("other-space", 1, 1),
			],
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				const query = (distance: DistanceSchema.Type) =>
					runQuery({
						query: {
							distance,
							selector,
						},
						runtime: snapshot,
					});
				return {
					self: yield* query("self"),
					close: yield* query("close"),
					nearClose: yield* query("near-close"),
					near: yield* query("near"),
					far: yield* query("far"),
				};
			}),
		);

		expect(readIds(result.self)).toEqual([
			"origin",
		]);
		expect(readIds(result.close)).toEqual([
			"close",
			"close-diagonal",
		]);
		expect(readIds(result.nearClose)).toEqual([
			"close",
			"close-diagonal",
			"near",
			"near-diagonal",
		]);
		expect(readIds(result.near)).toEqual([
			"near",
			"near-diagonal",
		]);
		expect(readIds(result.far)).toEqual([
			"close",
			"close-diagonal",
			"near",
			"near-diagonal",
			"far",
		]);
	});
});

it("universe includes the origin and remote Board spaces while excluding buffered and reserved material", () => {
	const snapshot = runtime({
		currentSpace: 9,
		items: [
			board("self", 0, 0),
			board("remote", 2, 0),
			item("buffer", {
				scope: "input",
				ownerItemId: "self",
				lineId: "line",
				inputIndex: 0,
			}),
			item("reserved", {
				scope: "reserved",
				jobId: "job",
				inputIndex: 0,
			}),
		],
	});
	const selected = Effect.runSync(
		runQuery({
			query: {
				distance: "universe",
				selector,
			},
			runtime: snapshot,
		}),
	);
	expect(readIds(selected)).toEqual([
		"self",
		"remote",
	]);
});

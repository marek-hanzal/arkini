import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { LocationSchema } from "~/item-location/schema/LocationSchema";
import { queryFx } from "~/engine/query/fx/queryFx";
import type { QuerySchema } from "~/item-definition/query/schema/QuerySchema";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";

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
		inventory: {
			width: 2,
			height: 2,
		},
		toolbarSize: 2,
	},
	start: {
		currentSpace: 0,
	},
	items: {
		tree: {
			uid: "tree",
			id: "tree",
			title: "Tree",
			description: "A living tree.",
			asset: {
				default: [
					"asset:tree",
				],
			},
			scope: "any",
			maxStackSize: 10,
			type: "simple",
		},
	},
});

const item = (id: string, location: LocationSchema.Type): RuntimeItemSchema.Type => ({
	id,
	item: config.items.tree,
	location,
	quantity: 1,
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
		instantGameplay: false,
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
	readonly queryOrigin?: GridLocationSchema.Type;
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
	it("uses exact Chebyshev rings within the origin board space", () => {
		const snapshot = runtime({
			items: [
				board("origin", 0, 0),
				board("close", 0, 1),
				board("near", 0, 2),
				board("far", 0, 3),
				board("other-space", 1, 1),
			],
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				const query = (distance: "self" | "close" | "near" | "far") =>
					runQuery({
						query: {
							distance,
							scope: "board",
							selector,
						},
						runtime: snapshot,
					});
				return {
					self: yield* query("self"),
					close: yield* query("close"),
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
		]);
		expect(readIds(result.near)).toEqual([
			"near",
		]);
		expect(readIds(result.far)).toEqual([
			"close",
			"near",
			"far",
		]);
	});

	it("maps board, passive, local-any, and universe reach without hidden ownership", () => {
		const snapshot = runtime({
			items: [
				board("origin", 0, 0),
				board("board", 0, 1),
				board("other-space", 1, 1),
				item("inventory", {
					scope: "inventory",
					position: {
						x: 0,
						y: 0,
					},
				}),
				item("toolbar", {
					scope: "toolbar",
					position: {
						x: 0,
						y: 0,
					},
				}),
				item("input-hidden", {
					scope: "input",
					ownerItemId: "owner:hidden",
					lineId: "line:hidden",
					inputIndex: 0,
				}),
				item("reserved-hidden", {
					scope: "reserved",
					jobId: "job:hidden",
				}),
			],
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				const query = (scope: "any" | "inventory" | "toolbar" | "universe") =>
					runQuery({
						query: {
							scope,
							selector,
						},
						runtime: snapshot,
					});
				return {
					board: yield* runQuery({
						query: {
							distance: "far",
							scope: "board",
							selector,
						},
						runtime: snapshot,
					}),
					inventory: yield* query("inventory"),
					toolbar: yield* query("toolbar"),
					any: yield* query("any"),
					universe: yield* query("universe"),
				};
			}),
		);

		expect(readIds(result.board)).toEqual([
			"board",
		]);
		expect(readIds(result.inventory)).toEqual([
			"inventory",
		]);
		expect(readIds(result.toolbar)).toEqual([
			"toolbar",
		]);
		expect(readIds(result.any)).toEqual([
			"origin",
			"board",
			"inventory",
			"toolbar",
		]);
		expect(readIds(result.universe)).toEqual([
			"origin",
			"board",
			"other-space",
			"inventory",
			"toolbar",
		]);
	});

	it("uses currentSpace when a passive origin asks for local-any reach", () => {
		const snapshot = runtime({
			currentSpace: 1,
			items: [
				board("space-zero", 0, 0),
				board("space-one", 1, 0),
				item("inventory", {
					scope: "inventory",
					position: {
						x: 0,
						y: 0,
					},
				}),
			],
		});
		const result = Effect.runSync(
			runQuery({
				queryOrigin: {
					scope: "inventory",
					position: {
						x: 0,
						y: 0,
					},
				},
				query: {
					scope: "any",
					selector,
				},
				runtime: snapshot,
			}),
		);

		expect(readIds(result)).toEqual([
			"space-one",
			"inventory",
		]);
	});

	it("rejects board reach before reading a passive origin runtime", () => {
		const result = Effect.runSync(
			Effect.result(
				queryFx({
					origin: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					query: {
						distance: "far",
						scope: "board",
						selector,
					},
				}).pipe(
					Effect.provideService(RuntimeFx, {
						read: Effect.die(
							new Error("Board origin rejection must precede Runtime read."),
						),
					}),
				),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				_tag: "BoardQueryOriginUnavailableError",
				origin: {
					scope: "inventory",
				},
			});
		}
	});
});

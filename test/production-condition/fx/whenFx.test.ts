import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { whenFx } from "~/production-condition/fx/whenFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:when-test",
		title: "When test",
		board: {
			width: 10,
			height: 10,
		},
		inventory: {
			width: 2,
			height: 2,
		},
	},
	start: {
		currentSpace: 0,
	},
	items: {
		source: {
			maxQueueSize: 1,
			lines: [],

			uid: "source",
			id: "source",
			title: "Source",
			description: "A query origin.",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:source",
				],
			},
			scope: "board",
			maxStackSize: 1,
		},
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
			scope: "any",
			maxStackSize: 10,
		},
	},
});

const placeItemFx = ({
	id,
	itemId,
	quantity,
	location,
}: {
	id: string;
	itemId: "source" | "tree";
	quantity: number;
	location: GridLocationSchema.Type;
}) => {
	return spawnItemFx({
		id,
		itemId,
		location,
		quantity,
	});
};

describe("whenFx", () => {
	it("treats Board conditions without a Board origin as false, not an empty zero-count query", () => {
		for (const scope of [
			"inventory",
			"toolbar",
		] as const) {
			const query = {
				scope: "board" as const,
				distance: "close" as const,
				selector: {
					type: "item" as const,
					itemId: "tree",
				},
			};
			const conditions: WhenSchema.Type[] = [
				{
					type: "exists",
					query,
				},
				{
					type: "count",
					count: 0,
					query,
				},
				{
					type: "range",
					min: 0,
					max: 1,
					query,
				},
			];
			const result = Effect.runSync(
				Effect.forEach(conditions, (when) =>
					whenFx({
						origin: {
							scope,
							position: {
								x: 0,
								y: 0,
							},
						},
						when,
					}),
				).pipe(
					Effect.provideService(RuntimeFx, {
						read: Effect.die(
							new Error("An unavailable Board origin must not read Runtime."),
						),
					}),
				),
			);
			expect(result).toEqual([
				false,
				false,
				false,
			]);
		}
	});

	it("evaluates exists, exact count, and inclusive range over query quantities", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* placeItemFx({
					id: "origin",
					itemId: "source",
					quantity: 1,
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 5,
							y: 5,
						},
					},
				});
				yield* placeItemFx({
					id: "board-close",
					itemId: "tree",
					quantity: 2,
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 6,
							y: 5,
						},
					},
				});
				yield* placeItemFx({
					id: "board-near",
					itemId: "tree",
					quantity: 4,
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 7,
							y: 5,
						},
					},
				});
				yield* placeItemFx({
					id: "inventory",
					itemId: "tree",
					quantity: 3,
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				const exists = yield* whenFx({
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					when: {
						query: {
							scope: "inventory",
							selector: {
								itemId: "tree",
								type: "item",
							},
						},
						type: "exists",
					},
				});
				const count = yield* whenFx({
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					when: {
						count: 9,
						query: {
							scope: "any",
							selector: {
								itemId: "tree",
								type: "item",
							},
						},
						type: "count",
					},
				});
				const range = yield* whenFx({
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					when: {
						max: 2,
						min: 2,
						query: {
							distance: "close",
							scope: "board",
							selector: {
								itemId: "tree",
								type: "item",
							},
						},
						type: "range",
					},
				});
				const rejected = yield* whenFx({
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					when: {
						count: 8,
						query: {
							scope: "any",
							selector: {
								itemId: "tree",
								type: "item",
							},
						},
						type: "count",
					},
				});

				return {
					count,
					exists,
					range,
					rejected,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result).toEqual({
			count: true,
			exists: true,
			range: true,
			rejected: false,
		});
	});
});

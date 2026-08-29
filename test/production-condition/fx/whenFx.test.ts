import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { whenFx } from "~/production-condition/fx/whenFx";

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
			uid: "source",
			id: "source",
			title: "Source",
			description: "A query origin.",
			asset: {
				default: [
					"asset:source",
				],
			},
			scope: "board",
			maxStackSize: 1,
			type: "simple",
		},
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

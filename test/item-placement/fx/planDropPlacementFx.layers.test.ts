import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { config, run, sourceLocation } from "~test/item-interaction/support/dropItemFixture";
import { placeDropForTestFx } from "~test/item-placement/support/placeDropForTestFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { startFx } from "~/game-start/fx/startFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { queryFx } from "~/item-query/fx/queryFx";

const layerConfig = GameConfigSchema.parse({
	...config,
	meta: {
		...config.meta,
		board: {
			width: 2,
			height: 1,
		},
	},
	items: {
		content: {
			...config.items.stone,
			uid: "content",
			id: "content",
			scope: "board",
			maxStackSize: 1,
		},
		ground: {
			...config.items.stone,
			uid: "ground",
			id: "ground",
			layer: "ground",
			scope: "board",
			maxStackSize: 1,
		},
	},
	start: {
		currentSpace: 0,
		board: [
			{
				itemId: "content",
				space: 0,
				x: 0,
				y: 0,
			},
			{
				itemId: "content",
				space: 0,
				x: 1,
				y: 0,
			},
		],
	},
});

describe("layer-aware canonical placement", () => {
	it("births and queries covered ground on a full content Board, then rejects full ground atomically", () => {
		run(
			Effect.gen(function* () {
				const started = yield* startFx();
				const originItemId = started.items[0]!.id;
				const place = () =>
					placeDropForTestFx({
						originItemId,
						drop: {
							itemId: "ground",
							placement: "drop",
							quantity: {
								min: 1,
								max: 1,
							},
							rules: [],
						},
					});
				yield* place();
				yield* place();
				const before = yield* readRuntimeFx();
				expect(before.items).toHaveLength(4);
				const queried = yield* queryFx({
					origin: sourceLocation,
					query: {
						scope: "board",
						distance: "self",
						selector: {
							type: "item",
							itemId: "ground",
						},
					},
				});
				expect(queried).toHaveLength(1);
				expect(queried[0]?.item.layer).toBe("ground");
				expect(Result.isFailure(yield* Effect.result(place()))).toBe(true);
				expect(yield* readRuntimeFx()).toBe(before);
			}),
			layerConfig,
		);
	});

	it("admits exact co-located start entries only on different Board layers", () => {
		for (const layer of [
			"content",
			"ground",
		] as const) {
			const startConfig = GameConfigSchema.parse({
				...layerConfig,
				items: {
					...layerConfig.items,
					ground: {
						...layerConfig.items.ground,
						layer,
					},
				},
				start: {
					currentSpace: 0,
					board: [
						{
							itemId: "content",
							space: 0,
							x: 0,
							y: 0,
						},
						{
							itemId: "ground",
							space: 0,
							x: 0,
							y: 0,
						},
					],
				},
			});
			run(
				Effect.gen(function* () {
					const outcome = yield* Effect.result(startFx());
					expect(Result.isSuccess(outcome)).toBe(layer === "ground");
					expect((yield* readRuntimeFx()).items).toHaveLength(layer === "ground" ? 2 : 0);
				}),
				startConfig,
			);
		}
	});
});

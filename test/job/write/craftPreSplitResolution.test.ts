import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { runTickRuntimeByFx } from "~/v1/tick/fx/runTickRuntimeByFx";

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:craft-pre-split",
		title: "Craft pre-split",
		board: {
			width: 3,
			height: 1,
		},
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	categories: {},
	items: {
		craft: {
			id: "craft",
			title: "Craft",
			description: "A stackable craft.",
			asset: {
				source: [
					"asset:craft",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
			type: "craft",
			charges: {
				amount: 1,
			},
			line: {
				id: "line:craft",
				title: "Run",
				description: "Runs until another craft is close.",
				runtimeMs: 1_000,
				input: [
					{
						type: "simple",
					},
				],
				rules: [
					{
						type: "disable",
						when: [
							{
								type: "exists",
								query: {
									scope: "board",
									distance: "close",
									selector: {
										type: "item",
										itemId: "craft",
									},
								},
							},
						],
					},
				],
			},
		},
	},
});

describe("craft start resolution", () => {
	it("authorizes from the pre-command world and lets the split consequence pause the job", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:craft",
					itemId: "craft",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 2,
				});
				const started = yield* startLineFx({
					ownerItemId: "runtime:craft",
					lineId: "line:craft",
				});
				const beforeTick = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const afterTick = yield* readRuntimeFx();

				return {
					afterTick,
					beforeTick,
					started,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.started.type).toBe("started");
		expect(result.beforeTick.items.filter((item) => item.item.id === "craft")).toHaveLength(2);
		expect(result.beforeTick.jobs[0]?.remainingMs).toBe(1_000);
		expect(result.afterTick.jobs[0]?.remainingMs).toBe(1_000);
	});
});

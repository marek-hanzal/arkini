import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";
import { StartLineResultEnumSchema } from "~/engine/job/schema/StartLineResultEnumSchema";

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

		expect(result.started.type).toBe(StartLineResultEnumSchema.enum.Started);
		expect(result.beforeTick.items.filter((item) => item.item.id === "craft")).toHaveLength(2);
		expect(result.beforeTick.jobs[0]?.remainingMs).toBe(1_000);
		expect(result.afterTick.jobs[0]?.remainingMs).toBe(1_000);
	});
});

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";

const config = GameConfigSchema.parse({
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
	items: {
		craft: {
			uid: "craft",
			id: "craft",
			title: "Craft",
			description: "A stackable craft.",
			asset: {
				default: [
					"asset:craft",
				],
			},
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

import { Effect } from "effect";
import { expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { createTemporaryLifetimeTestConfig } from "~test/temporary-item/fx/temporaryLifetime.test/createTemporaryLifetimeTestConfig";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";

it("preserves the full lifetime of temporary depletion output created by queue dispatch", () => {
	const base = createTemporaryLifetimeTestConfig();
	const producer = base.items.producer;
	if (producer?.type !== "producer") throw new Error("Expected producer fixture.");
	const config = GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			blocker: {
				...base.items.blocker,
				charges: {
					amount: 1,
					output: producer.lines[0].output,
				},
			},
			producer: {
				...producer,
				lines: [
					{
						...producer.lines[0],
						output: undefined,
						input: [
							{
								type: "deposit",
								charges: {
									from: "target",
									cost: 1,
								},
								query: {
									scope: "board",
									distance: "close",
									selector: {
										type: "item",
										itemId: "blocker",
									},
								},
							},
						],
					},
				],
			},
		},
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			for (const [itemId, x] of [
				[
					"producer",
					0,
				],
				[
					"blocker",
					1,
				],
			] as const) {
				yield* spawnItemFx({
					id: `runtime:${itemId}`,
					itemId,
					location: {
						scope: "board",
						space: 0,
						position: {
							x,
							y: 0,
						},
					},
					quantity: 1,
				});
			}
			yield* enqueueLineFx({
				ownerItemId: "runtime:producer",
				lineId: producer.lines[0].id,
			});
			const first = yield* advanceRuntimeStepFx(yield* readRuntimeFx());
			const second = yield* advanceRuntimeStepFx(first.runtime);
			return {
				first,
				second,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);

	expect(result.first.runtime.items.some((item) => item.item.id === "blocker")).toBe(false);
	expect(
		result.first.runtime.items.find((item) => item.item.id === "temporaryPlain")
			?.remainingDurationMs,
	).toBe(600);
	expect(
		result.second.runtime.items.find((item) => item.item.id === "temporaryPlain")
			?.remainingDurationMs,
	).toBe(500);
});

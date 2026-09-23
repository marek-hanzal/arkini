import { Effect, Exit } from "effect";
import { expect, it } from "vitest";

import { withdrawLineInputFx } from "~/production-input/fx/withdrawLineInputFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { createRuntimeItemFx } from "~/game-runtime/fx/createRuntimeItemFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import {
	lineId,
	ownerItemId,
	prepareQueuedBufferedLineFx,
	queuedInputTestConfig,
} from "~test/production-input/fx/withdrawLineInputFx.queue.test/prepareQueuedBufferedLineFx";

it("returns exactly one piece per click, retaining other identities and the queue", () => {
	Effect.runSync(
		Effect.gen(function* () {
			yield* prepareQueuedBufferedLineFx();
			const before = yield* readRuntimeFx();
			for (let remaining = 2; remaining >= 0; remaining--) {
				const result = yield* withdrawLineInputFx({
					ownerItemId,
					lineId,
					inputIndex: 0,
					amount: "one",
				});
				const after = yield* readRuntimeFx();
				expect(result.withdrawnItemCount).toBe(1);
				expect(after.jobQueue).toEqual(before.jobQueue);
				expect(after.items.filter((item) => item.location.scope === "input").length).toBe(
					remaining,
				);
				expect(
					after.items.filter(
						(item) => item.item.uid === "water" && item.location.scope === "board",
					).length,
				).toBe(3 - remaining);
			}
			const empty = yield* readRuntimeFx();
			expect(
				Exit.isFailure(
					yield* Effect.exit(
						withdrawLineInputFx({
							ownerItemId,
							lineId,
							inputIndex: 0,
							amount: "one",
						}),
					),
				),
			).toBe(true);
			expect(yield* readRuntimeFx()).toEqual(empty);
		}).pipe(
			useGameFx({
				config: queuedInputTestConfig,
			}),
		),
	);
});

it("returns a timed input with its exact identity and elapsed clock intact", () => {
	const config = GameConfigSchema.parse({
		...queuedInputTestConfig,
		items: {
			...queuedInputTestConfig.items,
			water: {
				...queuedInputTestConfig.items.water,

				clock: {
					durationMs: 12000,
				},
			},
		},
	});
	Effect.runSync(
		Effect.gen(function* () {
			yield* spawnItemFx({
				id: ownerItemId,
				itemUid: "workshop",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
			});
			const buffered = yield* createRuntimeItemFx({
				id: "timed-water",
				item: config.items.water,
				location: {
					scope: "input",
					ownerItemId,
					lineId,
					inputIndex: 0,
				},
			});
			yield* modifyRuntimeFx((runtime) =>
				Effect.succeed([
					undefined,
					{
						...runtime,
						items: [
							...runtime.items,
							buffered,
						].map((item) =>
							item.id === "timed-water"
								? {
										...item,
										schedule: {
											remainingDurationMs: 3200,
										},
									}
								: item,
						),
					},
					[],
				] as const),
			);
			yield* withdrawLineInputFx({
				ownerItemId,
				lineId,
				inputIndex: 0,
				amount: "one",
			});
			const after = yield* readRuntimeFx();
			expect(after.items.find((item) => item.id === "timed-water")).toMatchObject({
				location: {
					scope: "board",
				},
				schedule: {
					remainingDurationMs: 3200,
				},
			});
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
});

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { useGameFx } from "~test/support/game/useGameFx";
import { startLineRuntimeFx } from "~/production-job/fx/startLineRuntimeFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";

describe("startLineRuntimeFx", () => {
	it("atomically starts one job from the accepted consume and reserve plan", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const before = yield* readRuntimeFx();
				const consumedSource = before.items.find(
					(item) => item.item.id === "water" && item.location.scope === "input",
				);
				if (consumedSource === undefined) {
					return yield* Effect.die(new Error("Expected buffered water input."));
				}

				const [job, runtime, events] = yield* startLineRuntimeFx({
					ownerItemId: "runtime:forge",
					lineId: "line:forge:run",
					runtime: before,
				});

				return {
					consumedSource,
					events,
					job,
					runtime,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(result.runtime.jobs).toEqual([
			result.job,
		]);
		expect(
			result.runtime.items.find((item) => item.id === result.consumedSource.id),
		).toMatchObject({
			location: result.consumedSource.location,
			quantity: 3,
		});
		expect(
			result.runtime.items.find(
				(item) => item.item.id === "water" && item.location.scope === "job",
			),
		).toMatchObject({
			location: {
				jobId: result.job.id,
				scope: "job",
			},
			quantity: 3,
		});
		expect(
			result.runtime.items.find(
				(item) => item.item.id === "tool" && item.location.scope === "reserved",
			),
		).toMatchObject({
			location: {
				jobId: result.job.id,
				scope: "reserved",
			},
			quantity: 1,
		});
		expect(result.events).toContainEqual({
			type: GameEventEnumSchema.enum.ItemConsumed,
			sourceItemId: result.consumedSource.id,
			canonicalItemId: "water",
			sourceLocation: result.consumedSource.location,
			previousQuantity: 6,
			consumedQuantity: 3,
			resultingQuantity: 3,
		});
	});
});

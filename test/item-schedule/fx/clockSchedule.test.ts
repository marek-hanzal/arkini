import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import { removeRuntimeItemForTestFx } from "~test/item-interaction/support/removeRuntimeItemForTestFx";
import { existsWhen } from "~test/production-line/support/lineTestRuntime";
import { createClockConfig, spawnClockItemFx, tickClockFx } from "./clockSchedule.test/fixture";

const ownerItemId = "runtime:clock";

describe("Clock schedule boundaries", () => {
	it("pauses phase and lifetime through rules while previously accepted production continues", () => {
		const config = createClockConfig({
			clock: {
				durationMs: 1000,
				enable: false,
				rules: [
					{
						type: "enable",
						when: [
							existsWhen("permit"),
						],
					},
				],
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				const permit = yield* spawnClockItemFx("permit", 5);
				const running = yield* tickClockFx(300);
				yield* removeRuntimeItemForTestFx({
					itemId: permit.id,
					revision: permit.revision,
				});
				const paused = yield* tickClockFx(300);
				yield* spawnClockItemFx("permit", 5);
				const resumed = yield* tickClockFx(100);
				return {
					running,
					paused,
					resumed,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(
			result.running.items.find((item) => item.id === ownerItemId)?.schedule,
		).toMatchObject({
			remainingIntervalMs: 200,
			remainingDurationMs: 700,
		});
		expect(result.paused.items.find((item) => item.id === ownerItemId)?.schedule).toEqual(
			result.running.items.find((item) => item.id === ownerItemId)?.schedule,
		);
		expect(result.paused.jobs).toMatchObject([
			{
				remainingMs: 100,
			},
		]);
		expect(
			result.resumed.items.find((item) => item.id === ownerItemId)?.schedule,
		).toMatchObject({
			remainingIntervalMs: 100,
			remainingDurationMs: 600,
		});
		expect(result.resumed.jobs).toHaveLength(0);
	});
});

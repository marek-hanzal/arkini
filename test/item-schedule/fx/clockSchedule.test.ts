import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { setDefaultLineFx } from "~/production-line/fx/setDefaultLineFx";
import { setItemScheduleRunningFx } from "~/item-schedule/fx/setItemScheduleRunningFx";
import { resolveItemScheduleEnabledFx } from "~/item-schedule/fx/resolveItemScheduleEnabledFx";
import { useGameFx } from "~test/support/useGameFx";
import { removeRuntimeItemForTestFx } from "~test/item-interaction/support/removeRuntimeItemForTestFx";
import { existsWhen } from "~test/production-line/support/lineTestRuntime";
import { createClockConfig, spawnClockItemFx, tickClockFx } from "./clockSchedule.test/fixture";

const ownerItemId = "runtime:clock";

describe("Clock schedule boundaries", () => {
	it("retains a 250 ms phase and freezes the selected default per request without retroactive job time", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				const before = yield* tickClockFx(200);
				const pulse = yield* tickClockFx(100);
				yield* setDefaultLineFx({
					ownerItemId,
					lineId: "b",
				});
				const second = yield* tickClockFx(200);
				yield* setDefaultLineFx({
					ownerItemId,
					lineId: "a",
				});
				const third = yield* tickClockFx(300);
				return {
					before,
					pulse,
					second,
					third,
				};
			}).pipe(
				useGameFx({
					config: createClockConfig(),
				}),
			),
		);
		expect(result.before.jobs).toHaveLength(0);
		expect(result.before.items[0].schedule?.remainingIntervalMs).toBe(50);
		expect(result.pulse.jobs).toMatchObject([
			{
				lineId: "a",
				remainingMs: 400,
			},
		]);
		expect(result.pulse.items[0].schedule?.remainingIntervalMs).toBe(200);
		expect(result.second.jobQueue).toMatchObject([
			{
				lineId: "b",
			},
		]);
		expect(result.third.jobs).toMatchObject([
			{
				lineId: "a",
				remainingMs: 400,
			},
		]);
		expect(
			result.third.items.find((item) => item.id === ownerItemId)?.schedule
				?.remainingIntervalMs,
		).toBe(200);
	});

	it("pauses phase and lifetime through rules while previously accepted production continues", () => {
		const config = createClockConfig({
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

	it("persists manual off with phase and lifetime across hydration and bypasses rule evaluation", () => {
		const config = createClockConfig({
			durationMs: 1000,
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				yield* tickClockFx(100);
				yield* setItemScheduleRunningFx({
					ownerItemId,
					running: false,
				});
				const off = yield* tickClockFx(300);
				const hydrated = yield* fromStateFx({
					state: fromRuntimeFn({
						runtime: off,
					}),
				});
				const owner = hydrated.items[0];
				if (owner.item.type !== "clock") throw new Error("Expected Clock");
				// This deliberately invalid rule would fail if manual off did not short-circuit evaluation.
				const malformed = {
					...owner,
					item: {
						...owner.item,
						rules: [
							{
								type: "enable" as const,
								when: [
									{
										type: "invalid",
									},
								],
							},
						],
					},
				};
				const enabled = yield* resolveItemScheduleEnabledFx({
					item: malformed as unknown as typeof owner,
					runtime: hydrated,
				});
				yield* setItemScheduleRunningFx({
					ownerItemId,
					running: true,
				});
				const resumed = yield* tickClockFx(200);
				return {
					off,
					hydrated,
					enabled,
					resumed,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.off.items[0].schedule).toEqual({
			running: false,
			remainingIntervalMs: 150,
			remainingDurationMs: 900,
		});
		expect(result.hydrated.items[0].schedule).toEqual(result.off.items[0].schedule);
		expect(result.enabled).toBe(false);
		expect(result.resumed.jobs).toMatchObject([
			{
				lineId: "a",
				remainingMs: 400,
			},
		]);
	});
});

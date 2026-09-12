import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { setLineSelectionFx } from "~/production-line/fx/setLineSelectionFx";
import { useGameFx } from "~test/support/useGameFx";
import { removeRuntimeItemForTestFx } from "~test/item-interaction/support/removeRuntimeItemForTestFx";
import { existsWhen } from "~test/production-line/support/lineTestRuntime";
import { createClockConfig, spawnClockItemFx, tickClockFx } from "./clockSchedule.test/fixture";

const ownerItemId = "runtime:clock";

describe("Clock schedule boundaries", () => {
	it("retains a 250 ms phase and freezes the selected Clock line per request without retroactive job time", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				const before = yield* tickClockFx(200);
				const pulse = yield* tickClockFx(100);
				yield* setLineSelectionFx({
					selection: "clock",
					ownerItemId,
					lineId: "b",
				});
				const second = yield* tickClockFx(200);
				yield* setLineSelectionFx({
					selection: "clock",
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

	it("persists an empty Clock selection while timers age and keeps Default independent", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				yield* tickClockFx(100);
				yield* setLineSelectionFx({
					ownerItemId,
					selection: "default",
					lineId: "b",
				});
				yield* setLineSelectionFx({
					ownerItemId,
					selection: "clock",
					lineId: null,
				});
				const silent = yield* tickClockFx(300);
				const hydrated = yield* fromStateFx({
					state: fromRuntimeFn({
						runtime: silent,
					}),
				});
				yield* setLineSelectionFx({
					ownerItemId,
					selection: "clock",
					lineId: "b",
				});
				yield* setLineSelectionFx({
					ownerItemId,
					selection: "default",
					lineId: "a",
				});
				const selected = yield* tickClockFx(100);
				return {
					silent,
					hydrated,
					selected,
				};
			}).pipe(
				useGameFx({
					config: createClockConfig({
						clock: {
							durationMs: 1000,
						},
					}),
				}),
			),
		);
		expect(result.silent.items[0].schedule).toEqual({
			lineId: null,
			remainingIntervalMs: 100,
			remainingDurationMs: 600,
		});
		expect(result.silent.jobs).toHaveLength(0);
		expect(result.silent.jobQueue).toHaveLength(0);
		expect(result.hydrated.items[0].schedule).toEqual(result.silent.items[0].schedule);
		expect(result.hydrated.defaultLineByOwnerItemId[ownerItemId]).toBe("b");
		expect(result.selected.defaultLineByOwnerItemId[ownerItemId]).toBe("a");
		expect(result.selected.items[0].schedule).toEqual({
			lineId: "b",
			remainingIntervalMs: 250,
			remainingDurationMs: 500,
		});
		expect(result.selected.jobs).toMatchObject([
			{
				lineId: "b",
				remainingMs: 100,
			},
		]);
	});
});

import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { replayRuntimeStepsFx } from "~/game-tick/fx/replayRuntimeStepsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { advanceItemSchedulesFx } from "~/item-schedule/fx/advanceItemSchedulesFx";
import { selectClockLineFx } from "~/item-schedule/fx/selectClockLineFx";
import {
	createExpiryLine,
	createLine,
	createOutput,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { existsWhen } from "~test/production-line/support/lineTestRuntime";
import { useGameFx } from "~test/support/useGameFx";
import { createClockConfig, spawnClockItemFx } from "./clockSchedule.test/fixture";

const weightedLines = [
	{
		...createLine({
			uid: "light",
			clock: "clock-interval",
		}),
		clockWeight: 1,
		runtimeMs: 100_000,
	},
	{
		...createLine({
			uid: "heavy",
			clock: "clock-interval",
		}),
		clockWeight: 9,
		runtimeMs: 100_000,
	},
];

describe("weighted Clock admission", () => {
	it("draws lifetime lines by their weights without interval overrides", () => {
		const selected = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnClockItemFx();
				const runtime = yield* readRuntimeFx();
				const ids: string[] = [];
				for (let index = 0; index < 100; index++) {
					const line = yield* selectClockLineFx({
						role: "clock-lifetime",
						item: {
							...owner,
							id: `sample:${index}`,
						},
						runtime,
					});
					if (line !== undefined) ids.push(line.uid);
				}
				return ids;
			}).pipe(
				useGameFx({
					config: createClockConfig({
						lines: [
							{
								...createExpiryLine(
									createOutput([
										{
											itemUid: "result",
										},
									]),
									"expiry:light",
								),
								clockWeight: 1,
							},
							{
								...createExpiryLine(
									createOutput([
										{
											itemUid: "expired",
										},
									]),
									"expiry:heavy",
								),
								clockWeight: 9,
							},
						],
						clock: {
							durationMs: 100,
						},
					}),
				}),
			),
		);
		expect(selected.filter((id) => id === "expiry:heavy").length).toBeGreaterThan(70);
		expect(selected).toContain("expiry:light");
	});
	it("excludes failed gates and disable vetoes before selection while allowing hidden rule-enabled lines", () => {
		const selected = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnClockItemFx();
				const runtime = yield* readRuntimeFx();
				const ids = [];
				for (let pulseSequence = 0; pulseSequence < 30; pulseSequence++) {
					ids.push(
						(yield* selectClockLineFx({
							role: "clock-interval",
							runtime,
							item: {
								...owner,
								schedule: {
									...owner.schedule,
									pulseSequence,
								},
							},
						}))?.uid,
					);
				}
				return ids;
			}).pipe(
				useGameFx({
					config: createClockConfig({
						lines: [
							{
								...weightedLines[0],
								uid: "gated",
								clockWeight: 999,
								rules: [
									{
										type: "enable",
										when: [
											existsWhen("permit"),
										],
									},
								],
							},
							{
								...weightedLines[0],
								uid: "vetoed",
								clockWeight: 999,
								rules: [
									{
										type: "disable",
										when: [
											{
												...existsWhen("clock"),
												query: {
													...existsWhen("clock").query,
													distance: "self" as const,
												},
											},
										],
									},
								],
							},
							{
								...weightedLines[0],
								uid: "hidden",
								show: false,
								enable: false,
								rules: [
									{
										type: "enable",
										when: [
											{
												...existsWhen("clock"),
												query: {
													...existsWhen("clock").query,
													distance: "self" as const,
												},
											},
										],
									},
								],
							},
						],
					}),
				}),
			),
		);
		expect(new Set(selected)).toEqual(
			new Set([
				"hidden",
			]),
		);
	});

	it("uses relative weights and reproduces the same pulse sequence after hydration and regrouped ticks", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnClockItemFx();
				const runtime = yield* readRuntimeFx();
				const draws: string[] = [];
				for (let pulseSequence = 0; pulseSequence < 300; pulseSequence++) {
					const line = yield* selectClockLineFx({
						role: "clock-interval",
						runtime,
						item: {
							...owner,
							schedule: {
								...owner.schedule,
								pulseSequence,
							},
						},
					});
					if (line !== undefined) draws.push(line.uid);
				}
				const first = yield* replayRuntimeStepsFx({
					runtime,
					elapsedMs: 1000,
				});
				const restored = yield* fromStateFx({
					state: fromRuntimeFn({
						runtime: first.runtime,
					}),
				});
				const resumed = yield* replayRuntimeStepsFx({
					runtime: restored,
					elapsedMs: 1000,
				});
				const uninterrupted = yield* replayRuntimeStepsFx({
					runtime,
					elapsedMs: 2000,
				});
				return {
					draws,
					resumed: resumed.runtime,
					uninterrupted: uninterrupted.runtime,
				};
			}).pipe(
				useGameFx({
					config: createClockConfig({
						lines: weightedLines,
						maxQueueSize: 100,
						clock: {
							intervalMs: 100,
						},
					}),
				}),
			),
		);
		// Fixed owner/cursor seeds make this a repeatable distribution regression, not a probabilistic test.
		expect(result.draws.filter((id) => id === "heavy").length).toBeGreaterThan(240);
		expect(result.draws).toContain("light");
		expect(result.resumed.jobQueue.map((request) => request.lineUid)).toEqual(
			result.uninterrupted.jobQueue.map((request) => request.lineUid),
		);
		expect(result.resumed.items[0].schedule).toEqual(result.uninterrupted.items[0].schedule);
		expect(result.resumed.items[0].schedule?.pulseSequence).toBe(20);
	});

	it("consumes an empty pool pulse and does not reroll a selected line rejected by admission", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnClockItemFx();
				const runtime = yield* readRuntimeFx();
				const selected = yield* selectClockLineFx({
					role: "clock-interval",
					item: owner,
					runtime,
				});
				if (selected === undefined) throw new Error("Expected a selected line");
				// Exhaust only the drawn line's unit budget; the other pool member stays runnable.
				const blocked: RuntimeSchema.Type = {
					...runtime,
					items: [
						{
							...owner,
							item: {
								...owner.item,
								lines: owner.item.lines.map((line) =>
									line.uid === selected.uid
										? {
												...line,
												input: [
													{
														type: "simple" as const,
														units: {
															from: "self" as const,
															cost: 2,
														},
													},
												],
											}
										: line,
								),
							},
						},
					],
				};
				const rejected = yield* advanceItemSchedulesFx({
					stepStart: blocked,
					runtime: blocked,
				});
				const disabled = {
					...runtime,
					items: [
						{
							...owner,
							item: {
								...owner.item,
								lines: owner.item.lines.map((line) => ({
									...line,
									enable: false,
								})),
							},
						},
					],
				};
				const empty = yield* advanceItemSchedulesFx({
					stepStart: disabled,
					runtime: disabled,
				});
				return {
					rejected,
					empty,
				};
			}).pipe(
				useGameFx({
					config: createClockConfig({
						lines: weightedLines,
						units: {
							amount: 1,
						},
						clock: {
							intervalMs: 100,
						},
					}),
				}),
			),
		);
		for (const step of [
			result.rejected,
			result.empty,
		]) {
			expect(step.runtime.jobQueue).toEqual([]);
			expect(step.runtime.items[0].schedule?.pulseSequence).toBe(1);
		}
	});
});

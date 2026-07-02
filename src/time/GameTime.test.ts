import { describe, expect, it } from "vitest";
import {
	isGameTimeDue,
	isGameTimeWindowActive,
	readGameTimeDurationMs,
	readGameTimeProgress,
	readGameTimeRemainingMs,
	readMinGameWakeAtMs,
} from "~/time/GameTime";

describe("GameTime", () => {
	it("normalizes progress, duration, and remaining time", () => {
		expect(
			readGameTimeProgress({
				nowMs: 50,
				readyAtMs: 100,
				startAtMs: 0,
			}),
		).toBe(0.5);
		expect(
			readGameTimeProgress({
				nowMs: -50,
				readyAtMs: 100,
				startAtMs: 0,
			}),
		).toBe(0);
		expect(
			readGameTimeProgress({
				nowMs: 150,
				readyAtMs: 100,
				startAtMs: 0,
			}),
		).toBe(1);
		expect(
			readGameTimeDurationMs({
				readyAtMs: 100,
				startAtMs: 25,
			}),
		).toBe(75);
		expect(
			readGameTimeRemainingMs({
				nowMs: 75,
				readyAtMs: 100,
			}),
		).toBe(25);
		expect(
			readGameTimeRemainingMs({
				nowMs: 125,
				readyAtMs: 100,
			}),
		).toBe(0);
	});

	it("normalizes due windows and future wake selection", () => {
		expect(
			isGameTimeDue({
				nowMs: 100,
				readyAtMs: 100,
			}),
		).toBe(true);
		expect(
			isGameTimeDue({
				nowMs: 99,
				readyAtMs: 100,
			}),
		).toBe(false);
		expect(
			isGameTimeWindowActive({
				endAtMs: 200,
				nowMs: 100,
				startAtMs: 100,
			}),
		).toBe(true);
		expect(
			isGameTimeWindowActive({
				endAtMs: 200,
				nowMs: 200,
				startAtMs: 100,
			}),
		).toBe(false);
		expect(
			readMinGameWakeAtMs({
				nowMs: 100,
				values: [
					50,
					150,
					undefined,
					125,
				],
			}),
		).toBe(125);
		expect(
			readMinGameWakeAtMs({
				nowMs: 100,
				values: [
					50,
					100,
					undefined,
				],
			}),
		).toBeNull();
	});
});

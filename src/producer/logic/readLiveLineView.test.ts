import { describe, expect, it } from "vitest";
import type { LineView } from "~/board/view/LineViewSchema";
import { readLiveLineView } from "~/producer/logic/readLiveLineView";

const createLine = (overrides: Partial<LineView> = {}): LineView => ({
	durationMs: 1000,
	inProgress: true,
	isDefault: true,
	inputItemIds: [],
	inputs: [],
	inputsReady: true,
	inputsAvailable: true,
	name: "Test product",
	kind: "product" as const,
	lineId: "test.product",
	queueUsed: 1,
	progress: 0,
	queueFull: true,
	blocked: false,
	queueMax: 1,
	jobs: 1,
	readyAtMs: 1000,
	startAtMs: 0,
	...overrides,
});

describe("readLiveLineView", () => {
	it("recomputes product progress from live time", () => {
		const line = readLiveLineView({
			line: createLine(),
			nowMs: 500,
		});

		expect(line.progress).toBe(0.5);
	});

	it("clamps completed product progress", () => {
		const line = readLiveLineView({
			line: createLine(),
			nowMs: 1500,
		});

		expect(line.progress).toBe(1);
	});

	it("freezes paused product progress at the pause time", () => {
		const line = readLiveLineView({
			line: createLine({
				pausedAtMs: 250,
			}),
			nowMs: 1500,
		});

		expect(line.progress).toBe(0.25);
	});

	it("keeps blocked delivery lines unchanged instead of inventing progress", () => {
		const baseLine = createLine({
			deliveryBlocked: true,
			progress: undefined,
		});

		expect(
			readLiveLineView({
				line: baseLine,
				nowMs: 500,
			}),
		).toBe(baseLine);
	});

	it("keeps idle lines unchanged", () => {
		const baseLine = createLine({
			inProgress: false,
			progress: undefined,
			readyAtMs: undefined,
			startAtMs: undefined,
		});

		expect(
			readLiveLineView({
				line: baseLine,
				nowMs: 500,
			}),
		).toBe(baseLine);
	});
});

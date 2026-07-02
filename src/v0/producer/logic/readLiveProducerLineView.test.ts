import { describe, expect, it } from "vitest";
import type { ProducerLineView } from "~/v0/board/view/ProducerLineViewSchema";
import { readLiveProducerLineView } from "~/v0/producer/logic/readLiveProducerLineView";

const createLine = (overrides: Partial<ProducerLineView> = {}): ProducerLineView => ({
	durationMs: 1000,
	inProgress: true,
	isDefault: true,
	inputItemIds: [],
	inputs: [],
	inputsReady: true,
	inputsAvailable: true,
	name: "Test product",
	lineKind: "product" as const,
	lineId: "test.product",
	producerQueuedJobs: 1,
	progress: 0,
	queueFull: true,
	blocked: false,
	queueSize: 1,
	queuedJobs: 1,
	readyAtMs: 1000,
	startAtMs: 0,
	...overrides,
});

describe("readLiveProducerLineView", () => {
	it("recomputes product progress from live time", () => {
		const line = readLiveProducerLineView({
			line: createLine(),
			nowMs: 500,
		});

		expect(line.progress).toBe(0.5);
	});

	it("clamps completed product progress", () => {
		const line = readLiveProducerLineView({
			line: createLine(),
			nowMs: 1500,
		});

		expect(line.progress).toBe(1);
	});

	it("freezes paused product progress at the pause time", () => {
		const line = readLiveProducerLineView({
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
			readLiveProducerLineView({
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
			readLiveProducerLineView({
				line: baseLine,
				nowMs: 500,
			}),
		).toBe(baseLine);
	});
});

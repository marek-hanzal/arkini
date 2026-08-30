import { describe } from "vitest";
import {
	expect,
	focusConfig,
	focusRuntime,
	it,
	lineRunRuntime,
	readLines,
} from "../support/readItemDetailLinesFxFixture";

describe("readItemDetailLinesFx / queue order and visibility", () => {
	it("projects the active line before the earliest queued line", () => {
		const lines = readLines(
			focusRuntime({
				jobs: [
					{
						id: "job:active",
						ownerItemId: "runtime:workshop",
						lineId: "line:first",
						durationMs: 1_000,
						remainingMs: 500,
					},
				],
				jobQueue: [
					{
						id: "queue:earliest",
						ownerItemId: "runtime:workshop",
						lineId: "line:second",
					},
				],
			}),
			"runtime:workshop",
			focusConfig,
		);

		expect(lines).toMatchObject({
			kind: "available",
			focusLineId: "line:first",
		});
	});
	it("projects the earliest queued line once under canonical FIFO order", () => {
		const lines = readLines(
			focusRuntime({
				jobQueue: [
					{
						id: "queue:earliest",
						ownerItemId: "runtime:workshop",
						lineId: "line:second",
					},
					{
						id: "queue:duplicate",
						ownerItemId: "runtime:workshop",
						lineId: "line:second",
					},
					{
						id: "queue:later",
						ownerItemId: "runtime:workshop",
						lineId: "line:first",
					},
				],
			}),
			"runtime:workshop",
			focusConfig,
		);

		expect(lines).toMatchObject({
			kind: "available",
			focusLineId: "line:second",
		});
	});
	it("does not replace a stale earliest queue target with another visible line", () => {
		const lines = readLines(
			focusRuntime({
				jobQueue: [
					{
						id: "queue:hidden",
						ownerItemId: "runtime:workshop",
						lineId: "line:hidden",
					},
					{
						id: "queue:visible",
						ownerItemId: "runtime:workshop",
						lineId: "line:second",
					},
				],
			}),
			"runtime:workshop",
			focusConfig,
		);

		expect(lines.kind).toBe("available");
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.focusLineId).toBeUndefined();
	});
	it("uses canonical visibility, enable, input readiness, and effective runtime", () => {
		const blocked = readLines(
			lineRunRuntime({
				permit: true,
				booster: true,
				water: [
					2,
				],
			}),
		);
		expect(blocked.kind).toBe("available");
		if (blocked.kind !== "available") throw new Error("Expected available lines.");
		expect(blocked.line).toHaveLength(1);
		expect(blocked.line[0]).toMatchObject({
			lineId: "line:workshop:build",
			baseRuntimeMs: 1_000,
			effectiveRuntimeMs: 500,
			availability: {
				kind: "available",
				readiness: "inputs",
			},
			input: [
				{
					kind: "materials",
					storedQuantity: 2,
					required: {
						min: 3,
						max: 3,
					},
					missingQuantity: 1,
					availableCapacity: 3,
					ready: false,
				},
			],
		});

		const ready = readLines(
			lineRunRuntime({
				permit: true,
				booster: true,
				water: [
					2,
					1,
				],
			}),
		);
		expect(ready.kind).toBe("available");
		if (ready.kind !== "available") throw new Error("Expected available lines.");
		expect(ready.line[0]?.availability).toEqual({
			kind: "available",
			readiness: "ready",
		});
	});
});

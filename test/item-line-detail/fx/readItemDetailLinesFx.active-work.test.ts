import { describe } from "vitest";
import {
	JobStatusEnumSchema,
	expect,
	it,
	lineRunRuntime,
	readLines,
} from "../support/readItemDetailLinesFxFixture";
import type { RuntimeSchema } from "../support/readItemDetailLinesFxFixture";

describe("readItemDetailLinesFx / active work", () => {
	it("keeps an active hidden-by-default line inspectable while its owner is stored", () => {
		const runtime = lineRunRuntime({
			permit: false,
		});
		const stored = {
			...runtime,
			items: runtime.items.map((item) =>
				item.id === "runtime:workshop"
					? {
							...item,
							location: {
								scope: "toolbar" as const,
								position: {
									x: 0,
									y: 0,
								},
							},
						}
					: item,
			),
			jobs: [
				{
					id: "job:workshop",
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					durationMs: 1_000,
					remainingMs: 400,
				},
			],
		} satisfies RuntimeSchema.Type;
		const lines = readLines(stored);
		expect(lines.kind).toBe("available");
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.line).toMatchObject([
			{
				availability: {
					kind: "unavailable",
					reason: {
						kind: "owner-stored",
					},
				},
				activeJob: {
					status: JobStatusEnumSchema.enum.Paused,
					remainingMs: 400,
				},
			},
		]);
	});
	it("projects active work as running, paused, or ready from canonical job truth", () => {
		const job = {
			id: "job:workshop",
			ownerItemId: "runtime:workshop",
			lineId: "line:workshop:build",
			durationMs: 1_000,
			remainingMs: 400,
		} as const;
		const running = readLines({
			...lineRunRuntime({
				permit: true,
			}),
			jobs: [
				job,
			],
		});
		const paused = readLines({
			...lineRunRuntime({
				blocker: true,
				permit: true,
			}),
			jobs: [
				job,
			],
		});
		const ready = readLines({
			...lineRunRuntime({
				permit: true,
			}),
			jobs: [
				{
					...job,
					remainingMs: 0,
				},
			],
		});

		for (const projection of [
			running,
			paused,
			ready,
		]) {
			expect(projection.kind).toBe("available");
		}
		if (
			running.kind !== "available" ||
			paused.kind !== "available" ||
			ready.kind !== "available"
		) {
			throw new Error("Expected available lines.");
		}
		expect(running.line[0]?.activeJob?.status).toBe(JobStatusEnumSchema.enum.Running);
		expect(paused.line[0]?.activeJob?.status).toBe(JobStatusEnumSchema.enum.Paused);
		expect(ready.line[0]?.activeJob?.status).toBe(JobStatusEnumSchema.enum.AwaitingOutput);
	});
	it("keeps single-slot owners on a disabled Start action while work is active", () => {
		const base = lineRunRuntime({
			permit: true,
			water: [
				2,
				1,
			],
		});
		const runtime = {
			...base,
			items: base.items.map((item) =>
				item.id === "runtime:workshop" && item.item.type === "producer"
					? {
							...item,
							item: {
								...item.item,
								maxQueueSize: 1,
							},
						}
					: item,
			),
			jobs: [
				{
					id: "job:workshop",
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					durationMs: 1_000,
					remainingMs: 400,
				},
			],
		} satisfies RuntimeSchema.Type;

		const lines = readLines(runtime);
		expect(lines.kind).toBe("available");
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.line[0]).toMatchObject({
			availability: {
				kind: "available",
				readiness: "queue",
			},
			actions: {},
		});
	});
});

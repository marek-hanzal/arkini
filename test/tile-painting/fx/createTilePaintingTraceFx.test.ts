// @vitest-environment jsdom
import { Effect, Exit, Scope } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DiagnosticRecordSchema,
	type DiagnosticRecord,
} from "~electron/contract/diagnostics/DiagnosticRecord";
import { createTilePaintingTraceFx } from "~/tile-painting/fx/createTilePaintingTraceFx";

const records: DiagnosticRecord[] = [];
vi.mock("~/application-diagnostics/fx/writeDiagnosticRecordFx", () => ({
	writeDiagnosticRecordFx: (record: DiagnosticRecord) =>
		Effect.sync(() => {
			records.push(DiagnosticRecordSchema.parse(record));
		}),
}));
let scope: Scope.Closeable;
beforeEach(() => {
	vi.useFakeTimers();
	records.length = 0;
	scope = Effect.runSync(Scope.make());
});
afterEach(() => {
	Effect.runSync(Scope.close(scope, Exit.void));
	vi.useRealTimers();
});
const openFn = () =>
	Effect.runSync(
		createTilePaintingTraceFx("painting").pipe(Effect.provideService(Scope.Scope, scope)),
	);
const entriesFn = () =>
	records.flatMap(
		(record) =>
			record.data!.entries as {
				sequence: number;
				event: string;
				data: unknown;
				truncated: boolean;
			}[],
	);

describe("painter trace delivery", () => {
	it("flushes continuous input in ordered bounded batches and includes the final detach records", () => {
		const trace = openFn();
		for (let i = 0; i < 75; i++)
			Effect.runSync(
				trace.recordFx("pointer-move", {
					i,
				}),
			);
		expect(records.length).toBe(2);
		vi.advanceTimersByTime(200);
		expect(entriesFn()).toHaveLength(75);
		Effect.runSync(trace.recordFx("detached", {}));
		Effect.runSync(Scope.close(scope, Exit.void));
		expect(entriesFn().map((entry) => entry.sequence)).toEqual(
			Array.from(
				{
					length: 77,
				},
				(_, i) => i + 1,
			),
		);
		expect(entriesFn().at(-1)?.event).toBe("trace-closed");
		expect(new Set(records.map((record) => record.sessionId)).size).toBe(1);
		const length = records.length;
		vi.advanceTimersByTime(1000);
		Effect.runSync(trace.recordFx("late-event", {}));
		expect(records).toHaveLength(length);
	});

	it("snapshots mutable gesture evidence and marks bounded data rather than losing an IPC batch", () => {
		const trace = openFn();
		const point = {
			x: 12,
			y: 24,
		};
		Effect.runSync(trace.recordFx("pointer-move", point));
		point.x = 100;
		for (let i = 0; i < 10; i++)
			Effect.runSync(
				trace.recordFx(
					"large",
					Array.from(
						{
							length: 100,
						},
						() => "x".repeat(10000),
					),
				),
			);
		Effect.runSync(Scope.close(scope, Exit.void));
		expect(entriesFn()[0].data).toEqual({
			x: 12,
			y: 24,
		});
		expect(entriesFn().filter((entry) => entry.event === "large")).toHaveLength(10);
		expect(
			entriesFn()
				.filter((entry) => entry.event === "large")
				.every((entry) => entry.truncated),
		).toBe(true);
		expect(records.every((record) => JSON.stringify(record).length <= 65536)).toBe(true);
	});
});

import { Clock, Effect } from "effect";
import type { DiagnosticValue } from "~electron/contract/diagnostics/DiagnosticRecord";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import { toDiagnosticValueResultFn } from "~/application-diagnostics/fn/toDiagnosticValueFn";
import { writeDiagnosticRecordFx } from "~/application-diagnostics/fx/writeDiagnosticRecordFx";

export namespace createTilePaintingTraceFx {
	export interface Output {
		readonly recordFx: (event: string, data: unknown) => Effect.Effect<void>;
	}
}

/** Bounded, ordered painter evidence; transport is batched rather than written for every pointer sample. */
export const createTilePaintingTraceFx = (paintingId: string) =>
	Effect.gen(function* () {
		const clock = yield* Clock.Clock;
		return yield* Effect.acquireRelease(
			Effect.sync(() => {
				const sessionId = crypto.randomUUID();
				let sequence = 0;
				let entries: DiagnosticValue[] = [];
				let bytes = 0;
				let timer: ReturnType<typeof setTimeout> | undefined;
				let closed = false;
				const flushFn = () => {
					if (timer !== undefined) clearTimeout(timer);
					timer = undefined;
					if (entries.length === 0) return;
					Effect.runSync(
						writeDiagnosticRecordFx({
							level: "debug",
							category: [
								"editor",
								"tile-painting",
							],
							event: "canvas-trace",
							sessionId,
							data: {
								paintingId,
								applicationVersion: ArkiniAppVersion,
								traceVersion: 2,
								entries,
							},
						}),
					);
					entries = [];
					bytes = 0;
				};
				const recordFn = (event: string, data: unknown) => {
					if (closed) return;
					const bounded = toDiagnosticValueResultFn(data);
					const entry = {
						sequence: ++sequence,
						atMs: clock.currentTimeMillisUnsafe(),
						event,
						data: bounded.value,
						truncated: bounded.truncated,
					};
					const length = JSON.stringify(entry).length;
					if (entries.length >= 32 || bytes + length > 50 * 1024) flushFn();
					entries.push(entry);
					bytes += length;
					// Bound latency even while continuously drawing; detach flushes the final batch.
					timer ??= setTimeout(flushFn, 200);
				};
				return {
					recordFx: (event: string, data: unknown) =>
						Effect.sync(() => recordFn(event, data)),
					closeFx: Effect.sync(() => {
						recordFn("trace-closed", {});
						closed = true;
						flushFn();
					}),
				};
			}),
			(trace) => trace.closeFx,
		).pipe(
			Effect.map(
				(trace): createTilePaintingTraceFx.Output => ({
					recordFx: trace.recordFx,
				}),
			),
		);
	});

import { TickFx } from "~/game-tick/service/TickFx";
import type { TickPerformance } from "~/game-tick/type/TickPerformance";
import { Cause, Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import {
	type DiagnosticRecord,
	DiagnosticRecordSchema,
} from "~electron/contract/diagnostics/DiagnosticRecord";
import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";
import type {
	GameSession,
	GameTransition,
	GameSessionServices,
} from "~/game-session/type/GameSession";
import { installGameDiagnosticsFx } from "~/game-incident/fx/installGameDiagnosticsFx";
import { GameSessionFatalError } from "~/game-session/error/GameSessionFatalError";
import { RuntimeInvalidError } from "~/game-runtime/error/RuntimeInvalidError";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

const originalWindow = globalThis.window;
const runRendererEffectFn = <Value>(effect: Effect.Effect<Value>) => Effect.runSync(effect);

const testSerapack = {
	packageId: "package:test",
	contentHash: "0".repeat(64),
	title: "Test",
	version: "1.0",
	serakki: "1",
	source: "bundled",
	provenance: {
		type: "official",
	},
} satisfies SerapackDescriptor;

afterEach(() => {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: originalWindow,
	});
});

const createTransition = (sequence: number): GameTransition =>
	({
		sequence,
		previousRuntime: null,
		events: [],
		runtime: {
			cheats: {
				enabled: false,
				everEnabled: false,
				speedUpGameplay: false,
			},
			currentSpace: 0,
			items: [],
			jobs: [],
			jobQueue: [],
			defaultLineByOwnerItemId: {},
		},
	}) as unknown as GameTransition;

describe("Game diagnostics", () => {
	it("keeps tick-only commits quiet while preserving semantic, delivery, and fatal context", () => {
		const write = vi.fn<(record: DiagnosticRecord) => Promise<void>>((record) => {
			DiagnosticRecordSchema.parse(record);
			return Promise.resolve();
		});
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: {
				serakki: {
					diagnostics: {
						writeFn: write,
						writeApplicationFn: () => Promise.resolve(),
						openDirectoryFn: () => Promise.resolve(),
					},
					incident: {
						writeFn: () => Promise.resolve(),
					},
				} as Pick<SerakkiElectronApi.Api, "diagnostics">,
			},
		});
		let transitionListener: ((transition: GameTransition) => void) | undefined;
		let performanceListener: ((sample: TickPerformance) => void) | undefined;
		let fatalListener: (() => void) | undefined;
		let fatal: GameSessionFatalError | null = null;
		const session = {
			subscribeTransitionsFn: (
				listener: Parameters<GameSession["subscribeTransitionsFn"]>[0],
			) => {
				transitionListener = listener;
				listener(createTransition(0));
				return () => {
					transitionListener = undefined;
				};
			},
			subscribeFatalErrorFn: (
				listener: Parameters<GameSession["subscribeFatalErrorFn"]>[0],
			) => {
				fatalListener = listener;
				return () => {
					fatalListener = undefined;
				};
			},
			readFn: <Value, Error, Requirements extends GameSessionServices>(
				effect: Effect.Effect<Value, Error, Requirements>,
			) =>
				Effect.runSyncExit(
					effect.pipe(
						Effect.provideService(TickFx, {
							advanceRuntime: Effect.succeed(100),
							subscribePerformanceFn: (listenerFn) => {
								performanceListener = listenerFn;
								return () => {
									performanceListener = undefined;
								};
							},
						}),
					) as Effect.Effect<Value, Error>,
				),
			getFatalErrorFn: () => fatal,
			getTransitionSnapshotFn: () => createTransition(5),
		} satisfies Pick<
			GameSession,
			| "readFn"
			| "getFatalErrorFn"
			| "getTransitionSnapshotFn"
			| "subscribeFatalErrorFn"
			| "subscribeTransitionsFn"
		>;
		const diagnostics = Effect.runSync(
			installGameDiagnosticsFx({
				serapack: testSerapack,
				config: createJobTestConfig(),
				restored: true,
				runRendererEffectFn,
				session,
			}),
		);

		expect(write.mock.calls.map(([record]) => record.event)).toEqual([
			"session-started",
			"runtime-committed",
		]);
		transitionListener?.(createTransition(1));
		expect(write).toHaveBeenCalledTimes(2);

		const queuedTransition = {
			...createTransition(2),
			previousRuntime: createTransition(1).runtime,
			runtime: {
				...createTransition(2).runtime,
				jobQueue: [
					{
						id: "request:water:1",
						ownerItemId: "runtime:item:well",
						lineId: "line:water",
					},
				],
			},
		} as unknown as GameTransition;
		transitionListener?.(queuedTransition);
		expect(write.mock.calls.at(-1)?.[0]).toMatchObject({
			event: "runtime-committed",
			data: {
				sequence: 2,
				history: {
					queueAdded: [
						{
							requestId: "request:water:1",
							lineId: "line:water",
							owner: {
								runtimeItemId: "runtime:item:well",
							},
						},
					],
				},
			},
		});

		const defaultLineTransition = {
			...queuedTransition,
			sequence: 3,
			previousRuntime: queuedTransition.runtime,
			runtime: {
				...queuedTransition.runtime,
				defaultLineByOwnerItemId: {
					"runtime:item:well": "line:water",
				},
			},
		} as unknown as GameTransition;
		transitionListener?.(defaultLineTransition);
		expect(write.mock.calls.at(-1)?.[0]).toMatchObject({
			event: "runtime-committed",
			data: {
				sequence: 3,
				history: {
					defaultLinesChanged: [
						{
							owner: {
								runtimeItemId: "runtime:item:well",
							},
							lineId: "line:water",
						},
					],
				},
			},
		});
		transitionListener?.({
			...defaultLineTransition,
			sequence: 4,
		});
		expect(write).toHaveBeenCalledTimes(4);

		transitionListener?.({
			...defaultLineTransition,
			sequence: 5,
			events: [
				{
					type: "test-semantic-event",
				},
			],
		} as unknown as GameTransition);
		expect(write.mock.calls.at(-1)?.[0]).toMatchObject({
			event: "runtime-committed",
			data: {
				eventTypes: [
					"test-semantic-event",
				],
				sequence: 5,
			},
		});

		fatal = new GameSessionFatalError({
			source: "tick",
			cause: Cause.fail(
				new RuntimeInvalidError({
					result: {
						issues: [
							{
								type: "job:owner-not-on-grid",
								jobId: "job:stuck",
								ownerItemId: "runtime:item:worker",
								location: {
									scope: "delivery",
									phase: "outbound",
									generation: 0,
									remainingDurationMs: 500,
									origin: {
										scope: "board",
										space: 0,
										position: {
											x: 2,
											y: 3,
										},
									},
									target: {
										kind: "line-input",
										ownerItemId: "runtime:item:upgrade",
										lineId: "line:upgrade",
										input: [
											{
												inputIndex: 0,
												quantity: 1,
											},
										],
									},
								},
							},
						],
					},
				}),
			),
		});
		fatalListener?.();
		expect(write.mock.calls.at(-1)?.[0]).toMatchObject({
			event: "session-failed",
			level: "fatal",
			data: {
				error: {
					cause: {
						reasons: [
							{
								error: {
									_tag: "RuntimeInvalidError",
									result: {
										issues: [
											{
												type: "job:owner-not-on-grid",
												jobId: "job:stuck",
												ownerItemId: "runtime:item:worker",
											},
										],
									},
								},
							},
						],
					},
				},
				source: "tick",
				sequence: 5,
			},
		});

		const sample: TickPerformance = {
			windowMs: 1200,
			wakes: 20,
			advances: 20,
			failedAdvances: 0,
			simulationBudgetMs: 2000,
			advanceMs: 900,
			maxAdvanceMs: 200,
			maxWakeGapMs: 250,
			droppedWallMs: 1100,
			speedMultiplier: 20,
			items: 187,
			jobs: 180,
			queuedJobs: 0,
		};
		const retainedPerformanceListener = performanceListener;
		performanceListener?.(sample);
		expect(write.mock.calls.at(-1)?.[0]).toMatchObject({
			event: "tick-performance",
			sessionId: diagnostics.sessionId,
			data: sample,
		});
		diagnostics.close("saved");
		expect(performanceListener).toBeUndefined();
		const recordsAfterClose = write.mock.calls.length;
		retainedPerformanceListener?.(sample);
		expect(write).toHaveBeenCalledTimes(recordsAfterClose);
		expect(write.mock.calls.at(-1)?.[0]).toMatchObject({
			event: "session-ended",
			data: {
				reason: "saved",
				sequence: 5,
			},
		});
	});
});

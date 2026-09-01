import { Cause, Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import {
	type DiagnosticRecord,
	DiagnosticRecordSchema,
} from "~electron/contract/diagnostics/DiagnosticRecord";
import type { ArkpackDescriptor } from "~/arkpack-catalog/type/ArkpackDescriptor";
import type { GameSession, GameTransition } from "~/game-session/type/GameSession";
import { installGameDiagnosticsFx } from "~/installed-game/fx/installGameDiagnosticsFx";
import { GameSessionFatalError } from "~/game-session/error/GameSessionFatalError";
import { RuntimeInvalidError } from "~/game-runtime/error/RuntimeInvalidError";

const originalWindow = globalThis.window;
const runRendererEffectFn = <Value>(effect: Effect.Effect<Value>) => Effect.runSync(effect);

const testArkpack = {
	packageId: "package:test",
	contentHash: "content:test",
	title: "Test",
	version: "1.0",
	arkini: "1",
	source: "bundled",
	provenance: {
		type: "official",
	},
} satisfies ArkpackDescriptor;

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
				instantGameplay: false,
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
				arkini: {
					diagnostics: {
						writeFn: write,
						openDirectoryFn: () => Promise.resolve(),
					},
					incident: {
						writeFn: () => Promise.resolve(),
					},
				} as Pick<ArkiniElectronApi.Api, "diagnostics">,
			},
		});
		let transitionListener: ((transition: GameTransition) => void) | undefined;
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
			getFatalErrorFn: () => fatal,
			getTransitionSnapshotFn: () => createTransition(5),
		} satisfies Pick<
			GameSession,
			| "getFatalErrorFn"
			| "getTransitionSnapshotFn"
			| "subscribeFatalErrorFn"
			| "subscribeTransitionsFn"
		>;
		const diagnostics = Effect.runSync(
			installGameDiagnosticsFx({
				arkpack: testArkpack,
				arkpackBytes: new Uint8Array(),
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
				jobQueue: [
					{
						id: "request:water:1",
						ownerItemId: "runtime:item:well",
						lineId: "line:water",
					},
				],
			},
		});

		const defaultLineTransition = {
			...queuedTransition,
			sequence: 3,
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
				defaultLines: [
					{
						ownerItemId: "runtime:item:well",
						lineId: "line:water",
					},
				],
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

		diagnostics.close("saved");
		expect(write.mock.calls.at(-1)?.[0]).toMatchObject({
			event: "session-ended",
			data: {
				reason: "saved",
				sequence: 5,
			},
		});
	});
});

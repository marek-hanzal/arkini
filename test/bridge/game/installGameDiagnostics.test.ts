import { Cause } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArkiniElectronApi } from "../../../electron/contract/ArkiniElectronApi";
import {
	type DiagnosticRecord,
	DiagnosticRecordSchema,
} from "../../../electron/contract/diagnostics/DiagnosticRecord";
import type { GameSession, GameTransition } from "~/bridge/game/GameSession";
import { installGameDiagnostics } from "~/bridge/game/installGameDiagnostics";
import { GameSessionFatalError } from "~/bridge/game/GameSessionFatalError";
import { RuntimeInvalidError } from "~/engine/runtime/error/RuntimeInvalidError";

const originalWindow = globalThis.window;

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
			items: [],
			jobs: [],
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
						write,
						openDirectory: () => Promise.resolve(),
					},
				} as Pick<ArkiniElectronApi.Api, "diagnostics">,
			},
		});
		let transitionListener: ((transition: GameTransition) => void) | undefined;
		let fatalListener: (() => void) | undefined;
		let fatal: GameSessionFatalError | null = null;
		const session = {
			subscribeTransitions: (
				listener: Parameters<GameSession["subscribeTransitions"]>[0],
			) => {
				transitionListener = listener;
				listener(createTransition(0));
				return () => {
					transitionListener = undefined;
				};
			},
			subscribeFatalError: (listener: Parameters<GameSession["subscribeFatalError"]>[0]) => {
				fatalListener = listener;
				return () => {
					fatalListener = undefined;
				};
			},
			getFatalError: () => fatal,
		} as unknown as GameSession;
		const diagnostics = installGameDiagnostics({
			arkpack: {
				packageId: "package:test",
				hash: "content:test",
				gameId: "game:test",
				title: "Test",
				game: "1",
				source: "built-in",
				trust: {
					type: "official",
					keyId: "test",
				},
			},
			restored: true,
			session,
		});

		expect(write.mock.calls.map(([record]) => record.event)).toEqual([
			"session-started",
			"runtime-committed",
		]);
		transitionListener?.(createTransition(1));
		expect(write).toHaveBeenCalledTimes(2);

		transitionListener?.({
			...createTransition(2),
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
				sequence: 2,
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
				sequence: 2,
			},
		});

		diagnostics.close("saved");
		expect(write.mock.calls.at(-1)?.[0]).toMatchObject({
			event: "session-ended",
			data: {
				reason: "saved",
				sequence: 2,
			},
		});
	});
});

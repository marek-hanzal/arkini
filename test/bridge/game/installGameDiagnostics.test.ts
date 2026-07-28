import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArkiniElectronApi } from "../../../electron/contract/ArkiniElectronApi";
import type { DiagnosticRecord } from "../../../electron/contract/diagnostics/DiagnosticRecord";
import type { GameSession, GameTransition } from "~/bridge/game/GameSession";
import { installGameDiagnostics } from "~/bridge/game/installGameDiagnostics";
import { GameSessionFatalError } from "~/bridge/game/GameSessionFatalError";

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
		const write = vi.fn<(record: DiagnosticRecord) => Promise<void>>(() => Promise.resolve());
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
				contentHash: "content:test",
				gameId: "game:test",
				title: "Test",
				configVersion: "1",
				compressedSize: 0,
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
			source: "presentation",
			cause: new TypeError("destroyed transform"),
		});
		fatalListener?.();
		expect(write.mock.calls.at(-1)?.[0]).toMatchObject({
			event: "session-failed",
			level: "fatal",
			data: {
				source: "presentation",
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

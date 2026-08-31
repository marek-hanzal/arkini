import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import type { DiagnosticRecord } from "~electron/contract/diagnostics/DiagnosticRecord";
import type { ArkpackDescriptor } from "~/arkpack-catalog/type/ArkpackDescriptor";
import { installGameDiagnosticsFx } from "~/installed-game/fx/installGameDiagnosticsFx";
import { createTestGameSession } from "~test/support/createTestGameSession";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

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

describe("Game diagnostics fail-stop", () => {
	it("records the fatal state and closes after the frozen session is disposed", async () => {
		const write = vi.fn<(record: DiagnosticRecord) => Promise<void>>(() => Promise.resolve());
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: {
				arkini: {
					diagnostics: {
						writeFn: write,
						openDirectoryFn: () => Promise.resolve(),
					},
				} as Pick<ArkiniElectronApi.Api, "diagnostics">,
			},
		});
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const diagnostics = Effect.runSync(
			installGameDiagnosticsFx({
				arkpack: testArkpack,
				restored: false,
				runRendererEffectFn,
				session,
			}),
		);

		try {
			const failure = new Error("tick exploded");
			session.failStopFn("tick", failure);
			expect(session.readFn(Effect.void)).toMatchObject({
				_tag: "Failure",
			});
			expect(write.mock.calls.at(-1)?.[0]).toMatchObject({
				event: "session-failed",
				data: {
					error: {
						cause: {
							message: failure.message,
						},
					},
					source: "tick",
				},
			});

			await Effect.runPromise(session.disposeWithoutSaveFx);
			diagnostics.close("discarded");
			expect(write.mock.calls.at(-1)?.[0]).toMatchObject({
				event: "session-ended",
				data: {
					reason: "discarded",
				},
			});
		} finally {
			await Effect.runPromise(session.disposeWithoutSaveFx);
		}
	});
});

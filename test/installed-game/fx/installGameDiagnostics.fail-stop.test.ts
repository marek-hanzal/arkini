import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import type { DiagnosticRecord } from "~electron/contract/diagnostics/DiagnosticRecord";
import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";
import { installGameDiagnosticsFx } from "~/game-incident/fx/installGameDiagnosticsFx";
import { createTestGameSession } from "~test/support/createTestGameSession";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

const originalWindow = globalThis.window;
const runRendererEffectFn = <Value>(effect: Effect.Effect<Value>) => Effect.runSync(effect);
const testSerapack = {
	packageId: "package:test",
	contentHash: "0".repeat(64),
	title: "Test",
	version: "1.0",
	serakki: "1",
	projectRevision: 1,
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

describe("Game diagnostics fail-stop", () => {
	it("records the fatal state and closes after the frozen session is disposed", async () => {
		const write = vi.fn<(record: DiagnosticRecord) => Promise<void>>(() => Promise.resolve());
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: {
				serakki: {
					diagnostics: {
						writeFn: write,
						writeApplicationFn: () => Promise.resolve(),
						openDirectoryFn: () => Promise.resolve(),
						exportFn: () => Promise.resolve(false),
					},
					incident: {
						writeFn: () => Promise.resolve(),
					},
				} as Pick<SerakkiElectronApi.Api, "diagnostics">,
			},
		});
		const config = createJobTestConfig();
		const session = await createTestGameSession({
			config,
			tickIntervalMs: 60_000,
		});
		const diagnostics = Effect.runSync(
			installGameDiagnosticsFx({
				serapack: testSerapack,
				config,
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

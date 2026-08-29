// @vitest-environment jsdom

import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorServiceStatusAtom } from "~/ui/editor/EditorServiceStatusAtom";
import {
	EditorServiceReadinessTimeoutMs,
	refreshEditorServiceStatusFx,
} from "~/ui/editor/refreshEditorServiceStatusFx";

afterEach(() => {
	vi.useRealTimers();
	Reflect.deleteProperty(window, "arkini");
});

describe("refreshEditorServiceStatusFx", () => {
	it("retains a readiness publication made before the React consumer mounts", async () => {
		const status = {
			type: "ready" as const,
		};
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				editor: {
					status: () => Promise.resolve(status),
				},
			},
		});
		const registry = AtomRegistry.make({
			defaultIdleTTL: 10,
		});
		await Effect.runPromise(
			refreshEditorServiceStatusFx.pipe(
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);

		await new Promise((resolve) => setTimeout(resolve, 30));

		expect(registry.get(EditorServiceStatusAtom)).toEqual(status);
		registry.dispose();
	});

	it("publishes unavailable when status IPC never settles", async () => {
		vi.useFakeTimers();
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				editor: {
					status: () => new Promise(() => undefined),
				},
			},
		});
		const registry = AtomRegistry.make();
		const statusPromise = Effect.runPromise(
			refreshEditorServiceStatusFx.pipe(
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);

		await vi.advanceTimersByTimeAsync(EditorServiceReadinessTimeoutMs);

		const status = await statusPromise;
		expect(status).toEqual({
			type: "unavailable",
			message: "The editor service did not respond.",
		});
		expect(registry.get(EditorServiceStatusAtom)).toEqual(status);
		registry.dispose();
	});

	it("publishes unavailable and succeeds when status IPC rejects", async () => {
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				editor: {
					status: () => Promise.reject(new Error("IPC unavailable")),
				},
			},
		});
		const registry = AtomRegistry.make();
		const status = await Effect.runPromise(
			refreshEditorServiceStatusFx.pipe(
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);
		expect(status).toEqual({
			type: "unavailable",
			message: "The editor service did not respond.",
		});
		expect(registry.get(EditorServiceStatusAtom)).toEqual(status);
		registry.dispose();
	});
});

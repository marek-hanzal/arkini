// @vitest-environment jsdom

import { RegistryContext, scheduleTask, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	document.body.replaceChildren();
});

describe("Renderer Atom lifecycle", () => {
	it("runs a scoped atom finalizer exactly once when its owning registry is disposed", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		let finalizations = 0;
		const resourceAtom = Atom.make(
			Effect.acquireRelease(Effect.succeed("ready"), () =>
				Effect.sync(() => {
					finalizations += 1;
				}),
			),
		);
		const release = registry.mount(resourceAtom);

		await vi.waitFor(() => {
			const result = registry.get(resourceAtom);
			expect(AsyncResult.isSuccess(result)).toBe(true);
		});
		expect(finalizations).toBe(0);

		registry.dispose();
		registry.dispose();
		release();

		expect(finalizations).toBe(1);
	});

	it("does not duplicate scoped work or finalization under React StrictMode", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		let active = 0;
		let finalizations = 0;
		let starts = 0;
		const resourceAtom = Atom.make(
			Effect.acquireRelease(
				Effect.sync(() => {
					active += 1;
					starts += 1;
					return "ready";
				}),
				() =>
					Effect.sync(() => {
						active -= 1;
						finalizations += 1;
					}),
			).pipe(Effect.andThen(Effect.never)),
		);
		const Probe = () => {
			const result = useAtomValue(resourceAtom);
			return createElement("output", null, result._tag);
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(
					StrictMode,
					null,
					createElement(
						RegistryContext.Provider,
						{
							value: registry,
						},
						createElement(Probe),
					),
				),
			);
		});
		await vi.waitFor(() => expect(starts).toBe(1));

		expect(starts).toBe(1);
		expect(active).toBe(1);
		expect(finalizations).toBe(0);

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		expect(finalizations).toBe(0);

		registry.dispose();
		registry.dispose();

		expect(starts).toBe(1);
		expect(active).toBe(0);
		expect(finalizations).toBe(1);
	});
});

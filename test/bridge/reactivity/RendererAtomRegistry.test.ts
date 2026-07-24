// @vitest-environment jsdom

import { RegistryContext, scheduleTask, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement, useContext } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	RendererAtomRegistry,
	RendererAtomRuntime,
} from "~/bridge/reactivity/RendererAtomRegistry";

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

describe("Renderer Atom registry", () => {
	it("provides the exact process registry to every component below the root boundary", async () => {
		const seen: AtomRegistry.AtomRegistry[] = [];
		const Probe = () => {
			seen.push(useContext(RegistryContext));
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: RendererAtomRegistry,
					},
					createElement("div", null, createElement(Probe), createElement(Probe)),
				),
			);
		});

		expect(seen.length).toBeGreaterThanOrEqual(2);
		expect(seen.every((registry) => registry === RendererAtomRegistry)).toBe(true);
	});

	it("renders and updates one synchronous writable atom through the official hooks", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		const countAtom = Atom.make(0);
		const Counter = () => {
			const count = useAtomValue(countAtom);
			const setCount = useAtomSet(countAtom);
			return createElement(
				"button",
				{
					onClick: () => setCount(count + 1),
					type: "button",
				},
				String(count),
			);
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(Counter),
				),
			);
		});
		const button = container.querySelector("button");

		expect(button?.textContent).toBe("0");
		await act(async () => button?.click());
		expect(button?.textContent).toBe("1");
	});

	it("publishes Effect-backed atom success as AsyncResult", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		const resultAtom = RendererAtomRuntime.atom(Effect.succeed("ready"));
		const ResultProbe = () => {
			const result = useAtomValue(resultAtom);
			return createElement(
				"output",
				null,
				AsyncResult.isSuccess(result) ? result.value : result._tag,
			);
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(ResultProbe),
				),
			);
		});

		await vi.waitFor(() => expect(container.textContent).toBe("ready"));
	});

	it("runs an Atom.fn command and publishes both its result and state update", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		const totalAtom = Atom.make(0);
		const addAtom = RendererAtomRuntime.fn((amount: number, get) =>
			Effect.sync(() => {
				const total = get(totalAtom) + amount;
				get.set(totalAtom, total);
				return total;
			}),
		);
		const CommandProbe = () => {
			const total = useAtomValue(totalAtom);
			const result = useAtomValue(addAtom);
			const add = useAtomSet(addAtom);
			return createElement(
				"button",
				{
					onClick: () => add(21),
					type: "button",
				},
				`${total}:${AsyncResult.isSuccess(result) ? result.value : result._tag}`,
			);
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(CommandProbe),
				),
			);
		});
		const button = container.querySelector("button");

		await act(async () => button?.click());
		await vi.waitFor(() => expect(button?.textContent).toBe("21:21"));
	});
});

// @vitest-environment jsdom

import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AppearanceAtom } from "~/bridge/appearance/AppearanceAtom";
import { AppearanceDataset } from "~/ui/appearance/AppearanceDataset";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: Array<ReturnType<typeof AtomRegistry.make>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	document.body.replaceChildren();
	delete document.documentElement.dataset.theme;
	delete document.documentElement.dataset.accent;
});

describe("AppearanceAtom", () => {
	it("publishes one hydrated snapshot through the official hooks and applies it to the DOM", async () => {
		const registry = AtomRegistry.make();
		registries.push(registry);
		const seen: string[] = [];
		const Probe = () => {
			const appearance = useAtomValue(AppearanceAtom);
			const hydrate = useAtomSet(AppearanceAtom);
			seen.push(`${appearance.theme}:${appearance.accent}`);
			return createElement(
				"button",
				{
					onClick: () =>
						hydrate({
							theme: "light",
							accent: "blue",
						}),
					type: "button",
				},
				`${appearance.theme}:${appearance.accent}`,
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
					createElement(AppearanceDataset),
					createElement(Probe),
				),
			);
		});

		expect(container.textContent).toBe("dark:rose");
		expect(document.documentElement.dataset.theme).toBe("dark");
		expect(document.documentElement.dataset.accent).toBe("rose");

		await act(async () => container.querySelector("button")?.click());

		expect(container.textContent).toBe("light:blue");
		expect(document.documentElement.dataset.theme).toBe("light");
		expect(document.documentElement.dataset.accent).toBe("blue");
		expect(seen).not.toContain("light:rose");
		expect(seen).not.toContain("dark:blue");
	});
});

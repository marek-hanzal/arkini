// @vitest-environment jsdom

import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { useExclusiveAction } from "~/ui/action/useExclusiveAction";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

type Control = ReturnType<typeof useExclusiveAction<"first" | "second">>;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("useExclusiveAction", () => {
	it("keeps one same-tick mounted claim under StrictMode", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		let control: Control | undefined;
		const Probe = () => {
			control = useExclusiveAction<"first" | "second">();
			return null;
		};
		await act(async () => {
			root.render(createElement(StrictMode, null, createElement(Probe)));
		});
		if (control === undefined) throw new Error("Expected exclusive action control.");

		await act(async () => {
			expect(control?.claim("first")).toBe(true);
			expect(control?.claim("second")).toBe(false);
			control?.release("second");
			expect(control?.claim("second")).toBe(false);
		});
		expect(control.active).toBe("first");

		await act(async () => {
			control?.release("first");
		});
		expect(control.active).toBeNull();
	});
});

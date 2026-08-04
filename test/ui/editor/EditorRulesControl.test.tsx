// @vitest-environment jsdom

import { act, createElement, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/ui/form/EditorCollectionSelector", () => ({
	EditorCollectionSelector: ({
		children,
		count,
	}: {
		children: (index: number) => ReactNode;
		count: number;
	}) => createElement("div", null, count === 0 ? null : children(0)),
}));

vi.mock("~/ui/item/editor/EditorItemReferenceControl", () => ({
	EditorItemReferenceControl: () => createElement("span"),
}));

import type { EditorLineRule } from "~/bridge/item/editor/EditorItemModel";
import { EditorRulesControl } from "~/ui/item/editor/EditorRulesControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const Harness = () => {
	const [rules, setRules] = useState<EditorLineRule[]>([
		{
			type: "runtime:adjust",
			adjustMs: -1_500,
			when: [
				{
					type: "exists",
					query: {
						scope: "board",
						distance: "close",
						selector: {
							type: "item",
							itemId: "item:paper",
						},
					},
				},
			],
		},
	]);

	return createElement(
		"div",
		null,
		createElement(EditorRulesControl, {
			allowedTypes: [
				"runtime:adjust",
			],
			description: "Runtime rules.",
			onChange: (next) => setRules(next as EditorLineRule[]),
			rules,
		}),
		createElement("output", null, JSON.stringify(rules)),
	);
};

describe("EditorRulesControl", () => {
	it("edits runtime adjustments in seconds while storing whole milliseconds", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Harness)));

		const field = [
			...container.querySelectorAll("label"),
		].find((label) => label.textContent?.includes("Runtime adjustment (seconds)"));
		const input = field?.querySelector("input");
		if (input === undefined || input === null) throw new Error("Expected adjustment input.");
		expect(input.value).toBe("-1.5");

		const valueSetter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		if (valueSetter === undefined) throw new Error("Expected native input value setter.");
		await act(async () => {
			valueSetter.call(input, "2.25");
			input.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});

		expect(container.querySelector("output")?.textContent).toContain('"adjustMs":2250');
	});
});

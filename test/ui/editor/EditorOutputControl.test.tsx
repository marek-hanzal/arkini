// @vitest-environment jsdom

import { act, createElement, Fragment, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/ui/item/editor/EditorItemReferenceControl", () => ({
	EditorItemReferenceControl: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

vi.mock("~/ui/item/editor/useEditorItemOptionLabel", () => ({
	useEditorItemOptionLabel: () => (itemId: string, fallback: string) => itemId || fallback,
}));

import type { EditorOutput } from "~/bridge/item/editor/EditorItemModel";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorOutputControl } from "~/ui/item/editor/EditorOutputControl";

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
	const [output, setOutput] = useState<EditorOutput | undefined>(() =>
		structuredClone(EditorItemDraftDefaults.output),
	);
	return createElement(
		Fragment,
		null,
		output === undefined
			? null
			: createElement(EditorOutputControl, {
					onChange: setOutput,
					value: output,
				}),
		createElement("output", null, JSON.stringify(output ?? null)),
	);
};

const mount = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => root.render(createElement(Harness)));
	return container;
};

const click = async (container: HTMLElement, label: string) => {
	const button = [
		...container.querySelectorAll("button"),
	].find((candidate) => candidate.textContent === label || candidate.title === label);
	if (button === undefined) throw new Error(`Expected ${label} button.`);
	await act(async () => button.click());
};

const readOutput = (container: HTMLElement) =>
	JSON.parse(container.querySelector("output")?.textContent ?? "null") as EditorOutput;

describe("EditorOutputControl", () => {
	it("keeps nested output collections behind one active form at each level", async () => {
		const container = await mount();
		expect(container.querySelectorAll('[data-ui="EditorCollectionSelector"]')).toHaveLength(4);
		const readCollectionQueries = () =>
			Array.from(container.querySelectorAll<HTMLInputElement>('input[type="search"]')).map(
				(input) => input.value,
			);
		expect(readCollectionQueries()).toEqual(
			expect.arrayContaining([
				"Output set 1 — No item selected",
				"guaranteed roll 1 — No item selected",
				"Drop 1",
			]),
		);

		await click(container, "Add output set");
		expect(readOutput(container).set).toHaveLength(2);
		expect(container.querySelector("input")?.value).toContain("Output set 2");

		const outputSets = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (outputSets === null) throw new Error("Expected output set selector.");
		const valueSetter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		if (valueSetter === undefined) throw new Error("Expected native input value setter.");
		await act(async () => {
			valueSetter.call(outputSets, "Output set 1");
			outputSets.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});
		await act(async () => {
			outputSets.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
				}),
			);
		});
		await click(container, "Add roll");
		expect(readOutput(container).set[0].roll).toHaveLength(2);
		expect(readCollectionQueries()).toContain("guaranteed roll 2 — No item selected");

		await click(container, "Weighted");
		expect(readCollectionQueries()).toContain("Candidate 1");
		await click(container, "Add weighted candidate");
		expect(readOutput(container).set[0].roll[1]).toMatchObject({
			type: "weight",
			drop: [
				{},
				{},
				{},
			],
		});
	});

	it("removes the optional output when its final item drop is removed", async () => {
		const container = await mount();

		await click(container, "Remove drop");

		expect(container.querySelector("output")?.textContent).toBe("null");
		expect(container.querySelector('[data-ui="EditorCollectionSelector"]')).toBeNull();
	});
});

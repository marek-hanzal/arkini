// @vitest-environment jsdom

import { act, createElement, Fragment, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/ui/item/editor/EditorItemReferenceControl", () => ({
	EditorItemReferenceControl: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
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
	const [output, setOutput] = useState<EditorOutput>(() =>
		structuredClone(EditorItemDraftDefaults.output),
	);
	return createElement(
		Fragment,
		null,
		createElement(EditorOutputControl, {
			onChange: setOutput,
			value: output,
		}),
		createElement("output", null, JSON.stringify(output)),
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
		expect(container.querySelectorAll('[data-ui="EditorCollectionTabs"]')).toHaveLength(4);
		expect(container.textContent).toContain("Output set 1");
		expect(container.textContent).toContain("Roll 1");
		expect(container.textContent).toContain("Drop 1");

		await click(container, "Add output set");
		expect(readOutput(container).set).toHaveLength(2);
		expect(
			[
				...container.querySelectorAll("button"),
			].some((button) => button.textContent === "Output set 2"),
		).toBe(true);

		await click(container, "Output set 1");
		await click(container, "Add roll");
		expect(readOutput(container).set[0].roll).toHaveLength(2);
		expect(container.textContent).toContain("Roll 2");

		await click(container, "Weighted");
		expect(container.textContent).toContain("Candidate 1");
		expect(container.textContent).toContain("Candidate 2");
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
});

// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorVersionReferenceSelect } from "~/project-version/ui/EditorVersionReferenceSelect";
import type { ProjectVersionDescriptor } from "~/project-version/type/ProjectVersion";

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

const versions: ReadonlyArray<ProjectVersionDescriptor> = [
	{
		arkini: "0.5.0",
		arkpackVersion: "1.0",
		body: "Prepared the first playable economy.",
		createdAtMs: Date.UTC(2026, 0, 2, 3, 4, 5),
		projectId: "project-one",
		sourceRevision: 1,
		subject: "Initial economy",
		tag: "baseline",
		versionId: "version-one",
	},
	{
		arkini: "0.5.0",
		arkpackVersion: "1.1",
		body: "Rebalanced granular workshop costs.",
		createdAtMs: Date.UTC(2026, 0, 3, 4, 5, 6),
		parentVersionId: "version-one",
		projectId: "project-one",
		sourceRevision: 2,
		subject: "Workshop balance",
		tag: "economy-pass",
		versionId: "version-two",
	},
];

const changeInput = async (input: HTMLInputElement, value: string) => {
	const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (valueSetter === undefined) throw new Error("Expected native input value setter.");
	await act(async () => {
		valueSetter.call(input, value);
		input.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

describe("EditorVersionReferenceSelect", () => {
	it("finds and selects versions through their presented metadata", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const onChangeFn = vi.fn();
		await act(async () => {
			root.render(
				<EditorVersionReferenceSelect
					label="Before"
					onChangeFn={onChangeFn}
					value="current"
					versions={versions}
				/>,
			);
		});
		const input = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (input === null) throw new Error("Expected version search input.");
		await act(async () => input.focus());

		for (const query of [
			"Workshop balance",
			"granular workshop",
			"v1.1",
			"economy-pass",
			new Date(Date.UTC(2026, 0, 3, 4, 5, 6)).toLocaleString(),
		]) {
			await changeInput(input, query);
			const options = document.body.querySelectorAll<HTMLButtonElement>(
				'[data-ui="EditorSearchComboboxOption"]',
			);
			expect(options).toHaveLength(1);
			expect(options[0]?.textContent).toContain("Workshop balance");
		}

		const match = document.body.querySelector<HTMLButtonElement>(
			'[data-ui="EditorSearchComboboxOption"]',
		);
		if (match === null) throw new Error("Expected matching version option.");
		await act(async () => match.click());

		expect(onChangeFn).toHaveBeenCalledExactlyOnceWith("version-two");
	});
});

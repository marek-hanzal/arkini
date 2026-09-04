// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { SearchInput } from "~/ui/ui/SearchInput";

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

const SearchInputHarness = () => {
	const [value, setValueFn] = useState("stone");
	return (
		<SearchInput
			value={value}
			onValueChangeFn={setValueFn}
		/>
	);
};

describe("SearchInput", () => {
	it("clears a populated search through its canonical button", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(<SearchInputHarness />));

		const input = container.querySelector<HTMLInputElement>('input[type="search"]');
		const clearButton = container.querySelector<HTMLButtonElement>("button");
		if (input === null || clearButton === null) {
			throw new Error("Expected a populated search input with its clear button.");
		}

		await act(async () => clearButton.click());

		expect(input.value).toBe("");
		expect(container.querySelector("button")).toBeNull();
	});
});

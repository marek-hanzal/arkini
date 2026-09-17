// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { ResourceReferenceControl } from "~/authoring-form/ui/ResourceAutocompleteField";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

const state = vi.hoisted(() => ({
	useResourceUrlFn: vi.fn((_resourceId?: string) => undefined),
}));
vi.mock("~/authoring-session/ui/ResourceUrlSession", () => ({
	useResourceUrl: state.useResourceUrlFn,
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		resources: [
			{
				id: "track-one",
				type: "music",
				name: "Evening",
				size: 12,
				version: "v1",
			},
			{
				id: "track-two",
				type: "music",
				name: "Evening",
				size: 12,
				version: "v2",
			},
		],
	}),
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("selects the exact audio identity among duplicate names without requesting audio bodies", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	let selected = "";
	const Form = () => {
		const [value, setValueFn] = useState("");
		selected = value;
		return (
			<ResourceReferenceControl
				label="Music"
				emptyLabel="Empty"
				resourceType="music"
				value={value}
				onChangeFn={setValueFn}
			/>
		);
	};
	try {
		await act(async () =>
			root.render(
				<TranslationTestProvider>
					<Form />
				</TranslationTestProvider>,
			),
		);
		const input = container.querySelector<HTMLInputElement>(
			'[data-ui="EditorSearchComboboxInput"]',
		);
		if (input === null) throw new Error("Resource picker missing.");
		await act(async () => input.click());
		const optionsFn = () => [
			...document.querySelectorAll<HTMLButtonElement>(
				'[data-ui="EditorSearchComboboxOption"]',
			),
		];
		await vi.waitFor(() => expect(optionsFn()).toHaveLength(2));
		const target = optionsFn().find((option) => option.textContent?.includes("track-two"));
		if (target === undefined) throw new Error("Second audio identity missing.");
		expect(target.textContent).toContain("Evening");
		await act(async () => target.click());
		expect(selected).toBe("track-two");
		expect(input.value).toBe("Evening");
		expect(state.useResourceUrlFn.mock.calls.length).toBeGreaterThan(0);
		expect(state.useResourceUrlFn.mock.calls.every(([id]) => id === undefined)).toBe(true);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { InputSchema } from "~/production-input/schema/InputSchema";

const navigation = vi.hoisted(() => ({
	inputIndex: 1,
}));
vi.mock("~/item-authoring/ui/FormContext", () => ({
	useFormSession: () => ({
		...navigation,
		form: {
			store: {},
		},
		itemUid: "owner",
	}),
}));
vi.mock("@tanstack/react-form", () => ({
	useStore: () => false,
}));
vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => null,
}));
vi.mock("~/item-authoring/ui/useFormValidationIssues", () => ({
	useFormValidationFocusIndex: () => undefined,
	useFormValidationIssues: () => [],
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: {},
		},
	}),
}));
vi.mock("~/authoring-form/ui/useEditorItemSearchOptions", () => ({
	useEditorItemOptionLabel: () => (id: string, fallback: string) => id || fallback,
}));
vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (text: string) => text,
	}),
}));
vi.mock("~/production-authoring/ui/InputControl", () => ({
	InputControl: ({ input }: { input: InputSchema.Type }) => (
		<output data-input>
			{input.type === "materials"
				? input.query.selector.itemUid
				: input.type === "units"
					? input.query.selector.itemUid
					: "simple"}
		</output>
	),
}));
vi.mock("~/editor-control/ui/EditorSearchCombobox", () => ({
	EditorSearchCombobox: ({
		value,
		onChangeFn,
	}: {
		value: string;
		onChangeFn: (value: string | undefined) => void;
	}) =>
		createElement(
			"button",
			{
				"data-select-first": "",
				onClick: () => onChangeFn("0"),
			},
			value,
		),
}));
import { InputsControl } from "~/production-authoring/ui/InputsControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
it("selects the exact routed input without locking later selection", async () => {
	const value: InputSchema.Type[] = [
		"first",
		"target",
		"third",
	].map((itemUid) => ({
		type: "units",
		query: {
			distance: "far",
			selector: {
				type: "item",
				itemUid,
			},
		},
	}));
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	navigation.inputIndex = 1;
	try {
		await act(async () =>
			root.render(
				<InputsControl
					value={value}
					onChangeFn={() => {}}
				/>,
			),
		);
		expect(container.querySelector("[data-input]")?.textContent).toBe("target");
		await act(async () =>
			container.querySelector<HTMLButtonElement>("[data-select-first]")?.click(),
		);
		expect(container.querySelector("[data-input]")?.textContent).toBe("first");
		navigation.inputIndex = 2;
		await act(async () =>
			root.render(
				<InputsControl
					value={value}
					onChangeFn={() => {}}
				/>,
			),
		);
		expect(container.querySelector("[data-input]")?.textContent).toBe("third");
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

it("keeps the required last-input remove control visible and disabled", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const onChangeFn = vi.fn();
	const value: InputSchema.Type[] = [
		{
			type: "simple",
		},
	];
	try {
		await act(async () =>
			root.render(
				<InputsControl
					value={value}
					onChangeFn={onChangeFn}
				/>,
			),
		);
		const remove = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorInputsCollection"] [data-ui="EditorCollectionRemove"]',
		);
		expect(remove).not.toBeNull();
		expect(remove?.disabled).toBe(true);

		await act(async () =>
			root.render(
				<InputsControl
					emptyAllowed
					value={value}
					onChangeFn={onChangeFn}
				/>,
			),
		);
		expect(remove?.disabled).toBe(false);
		await act(async () => remove?.click());
		expect(onChangeFn).toHaveBeenCalledWith([]);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { InputSchema } from "~/production-input/schema/InputSchema";

const navigation = vi.hoisted(() => ({
	inputIndex: 1,
	selfUnitsEnabled: false,
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
	useStore: () => navigation.selfUnitsEnabled,
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
		<output
			data-input
			data-input-value={JSON.stringify(input)}
		>
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

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	navigation.inputIndex = 0;
	navigation.selfUnitsEnabled = false;
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const renderCollection = async (allowMaterials = true) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	let value: InputSchema.Type[] = [
		{
			type: "simple",
		},
	];
	const onChangeFn = vi.fn((next: InputSchema.Type[]) => {
		value = next;
		renderFn();
	});
	const renderFn = () =>
		root.render(
			<InputsControl
				allowMaterials={allowMaterials}
				value={value}
				onChangeFn={onChangeFn}
			/>,
		);
	await act(async () => renderFn());
	const add = container.querySelector<HTMLButtonElement>('[data-ui="EditorCollectionAdd"]');
	if (add === null) throw new Error("Expected the Inputs add control.");
	return {
		container,
		add,
		onChangeFn,
		renderFn,
	};
};

const findOption = (id: string) => {
	const option = document.querySelector<HTMLButtonElement>(
		`[data-ui="ActionMenuOption"][data-ui-id="${id}"]`,
	);
	if (option === null) throw new Error(`Expected ${id} add option.`);
	return option;
};

it("opens and dismisses the add menu without changing inputs or selection", async () => {
	const { container, add, onChangeFn } = await renderCollection();
	const selectedBefore = container
		.querySelector("[data-input]")
		?.getAttribute("data-input-value");
	await act(async () => add.click());
	expect(findOption("simple")).not.toBeNull();
	expect(onChangeFn).not.toHaveBeenCalled();
	await act(async () => {
		document.body.dispatchEvent(
			new MouseEvent("pointerdown", {
				bubbles: true,
			}),
		);
	});
	expect(document.querySelector('[data-ui="ActionMenuOption"]')).toBeNull();
	expect(onChangeFn).not.toHaveBeenCalled();
	expect(container.querySelector("[data-input]")?.getAttribute("data-input-value")).toBe(
		selectedBefore,
	);
});

it("creates and selects each chosen input variant while preserving existing inputs", async () => {
	navigation.selfUnitsEnabled = true;
	const { container, add, onChangeFn } = await renderCollection();
	const query = {
		distance: "far",
		selector: {
			type: "item",
			itemUid: "",
		},
	} as const;
	const variants: ReadonlyArray<
		readonly [
			string,
			InputSchema.Type,
		]
	> = [
		[
			"simple",
			{
				type: "simple",
			},
		],
		[
			"materials-consume",
			{
				type: "materials",
				mode: "consume",
				quantity: {
					min: 1,
					max: 1,
				},
				query,
			},
		],
		[
			"materials-reserve",
			{
				type: "materials",
				mode: "reserve",
				quantity: {
					min: 1,
					max: 1,
				},
				query,
			},
		],
		[
			"units-target",
			{
				type: "units",
				units: {
					cost: 1,
					from: "target",
				},
				query: {
					...query,
					distance: "close",
				},
			},
		],
		[
			"units-self",
			{
				type: "units",
				units: {
					cost: 1,
					from: "self",
				},
				query: {
					distance: "self",
					selector: {
						type: "item",
						itemUid: "owner",
					},
				},
			},
		],
	];
	const expected: InputSchema.Type[] = [
		{
			type: "simple",
		},
	];
	for (const [id, input] of variants) {
		await act(async () => add.click());
		await act(async () => findOption(id).click());
		expected.push(input);
		expect(onChangeFn).toHaveBeenLastCalledWith(expected);
		expect(
			JSON.parse(
				container.querySelector("[data-input]")?.getAttribute("data-input-value") ?? "null",
			),
		).toEqual(input);
		expect(container.querySelector("[data-select-first]")?.textContent).toBe(
			String(expected.length - 1),
		);
		expect(document.querySelector('[data-ui="ActionMenuOption"]')).toBeNull();
	}
	expect(onChangeFn).toHaveBeenCalledTimes(variants.length);
});

it("rejects self Units until enabled on the current form and binds an admitted draft to its owner", async () => {
	const { add, onChangeFn, renderFn } = await renderCollection();
	await act(async () => add.click());
	expect(findOption("units-self").disabled).toBe(true);
	await act(async () => findOption("units-self").click());
	expect(onChangeFn).not.toHaveBeenCalled();
	navigation.selfUnitsEnabled = true;
	await act(async () => renderFn());
	expect(findOption("units-self").disabled).toBe(false);
	await act(async () => findOption("units-self").click());
	expect(onChangeFn).toHaveBeenCalledExactlyOnceWith([
		{
			type: "simple",
		},
		{
			type: "units",
			units: {
				cost: 1,
				from: "self",
			},
			query: {
				distance: "self",
				selector: {
					type: "item",
					itemUid: "owner",
				},
			},
		},
	]);
});

it("does not offer material input creation for actions", async () => {
	const { add, onChangeFn } = await renderCollection(false);
	await act(async () => add.click());
	expect(
		document.querySelector('[data-ui="ActionMenuOption"][data-ui-id="materials-consume"]'),
	).toBeNull();
	expect(
		document.querySelector('[data-ui="ActionMenuOption"][data-ui-id="materials-reserve"]'),
	).toBeNull();
	await act(async () => findOption("units-target").click());
	expect(onChangeFn).toHaveBeenCalledWith([
		{
			type: "simple",
		},
		{
			type: "units",
			units: {
				cost: 1,
				from: "target",
			},
			query: {
				distance: "close",
				selector: {
					type: "item",
					itemUid: "",
				},
			},
		},
	]);
});

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

it("allows clearing the last input to choose another type", async () => {
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
		expect(remove?.disabled).toBe(false);
		await act(async () => remove?.click());
		expect(onChangeFn).toHaveBeenCalledWith([]);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

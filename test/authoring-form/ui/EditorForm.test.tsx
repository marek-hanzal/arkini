// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { useAppForm } from "~/authoring-form/ui/EditorForm";

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

const EditorFormHarness = () => {
	const form = useAppForm({
		defaultValues: {
			optional: 2 as number | undefined,
			required: 3,
			runtimeMs: 2_500,
		},
	});
	return (
		<>
			<form.AppField name="optional">
				{(field) => (
					<field.NumberField
						optional
						label="Optional"
					/>
				)}
			</form.AppField>
			<form.AppField name="required">
				{(field) => <field.NumberField label="Required" />}
			</form.AppField>
			<form.AppField name="runtimeMs">
				{(field) => <field.SecondsField label="Runtime" />}
			</form.AppField>
			<form.Subscribe selector={(state) => state.values}>
				{(values) => (
					<output
						data-optional={String(values.optional)}
						data-required={String(values.required)}
						data-runtime-ms={String(values.runtimeMs)}
					/>
				)}
			</form.Subscribe>
		</>
	);
};

const renderHarness = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(<EditorFormHarness />);
	});
	return container;
};

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

describe("EditorForm value adapters", () => {
	it("preserves optional empty, required empty, and millisecond conversions", async () => {
		const container = await renderHarness();
		const optional = container.querySelector<HTMLInputElement>('input[name="optional"]');
		const required = container.querySelector<HTMLInputElement>('input[name="required"]');
		const runtime = container.querySelector<HTMLInputElement>('input[name="runtimeMs"]');
		const output = container.querySelector<HTMLOutputElement>("output");
		if (optional === null || required === null || runtime === null || output === null)
			throw new Error("Expected form value controls.");

		expect(runtime.value).toBe("2.5");
		await changeInput(optional, "");
		await changeInput(required, "");
		await changeInput(runtime, "1.2346");

		expect(output.dataset.optional).toBe("undefined");
		expect(output.dataset.required).toBe("NaN");
		expect(output.dataset.runtimeMs).toBe("1235");
	});
});

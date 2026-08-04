// @vitest-environment jsdom

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/ui/resource/editor/EditorAssetAutocompleteField", () => ({
	EditorAssetAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

vi.mock("~/ui/item/editor/EditorItemAutocompleteField", () => ({
	EditorItemAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import {
	EditorItemFormSchema,
	type EditorItemFormValues,
} from "~/bridge/item/editor/EditorItemFormSchema";
import { useAppForm } from "~/ui/form/EditorForm";

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

const mount = async (element: ReactNode) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => root.render(element));
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

let resetLocalValues: () => void = () => undefined;

const LocalValueHarness = () => {
	const form = useAppForm({
		defaultValues: {
			amount: 4,
			enabled: true,
			name: "Original",
			runtimeMs: 24_000,
		},
	});
	resetLocalValues = () => form.reset();
	const values = useStore(form.store, (state) => state.values);
	return (
		<>
			<form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>
			<form.AppField name="amount">
				{(field) => <field.NumberField label="Amount" />}
			</form.AppField>
			<form.AppField name="runtimeMs">
				{(field) => <field.SecondsField label="Runtime (seconds)" />}
			</form.AppField>
			<form.AppField name="enabled">
				{(field) => (
					<field.BoolToggle
						checkedIcon="icon-[lucide--circle-check]"
						checkedLabel="Enabled"
						description="Controls whether this value is enabled."
						uncheckedIcon="icon-[lucide--circle-x]"
						uncheckedLabel="Disabled"
					/>
				)}
			</form.AppField>
			<output data-testid="values">
				{values.name}|{Number.isNaN(values.amount) ? "NaN" : values.amount}|
				{values.runtimeMs}|{values.enabled ? "enabled" : "disabled"}
			</output>
		</>
	);
};

const submittedItems: EditorItem[] = [];

const validationDefaults: EditorItemFormValues = {
	uid: "q12cmsx5ussy30wyjiea8yaw",
	id: "item:test",
	type: "simple",
	title: "Test item",
	description: "A valid item used by the editor form test.",
	asset: {
		default: [
			"item-test",
		],
	},
	scope: "any",
	maxStackSize: 1,
};

const ValidationHarness = () => {
	const form = useAppForm({
		defaultValues: validationDefaults,
		validationLogic: revalidateLogic({
			mode: "submit",
			modeAfterSubmission: "change",
		}),
		validators: {
			onDynamic: EditorItemFormSchema,
		},
		onSubmit: ({ value }) => {
			submittedItems.push(EditorItemFormSchema.parse(value));
		},
	});
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<form.AppField name="title">
				{(field) => <field.TextField label="Title" />}
			</form.AppField>
			<button type="submit">Submit</button>
		</form>
	);
};

describe("editor form fields", () => {
	it("keeps local values in the form store and resets the visible controls", async () => {
		const container = await mount(createElement(LocalValueHarness));
		const name = container.querySelector<HTMLInputElement>('input[name="name"]');
		const amount = container.querySelector<HTMLInputElement>('input[name="amount"]');
		const runtime = container.querySelector<HTMLInputElement>('input[name="runtimeMs"]');
		const enabled = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Enabled",
		);
		if (name === null || amount === null || runtime === null || enabled === undefined) {
			throw new Error("Missing form inputs.");
		}

		await changeInput(name, "Changed");
		await changeInput(amount, "");
		await changeInput(runtime, "1.25");
		await act(async () => enabled.click());
		expect(container.querySelector('[data-testid="values"]')?.textContent).toBe(
			"Changed|NaN|1250|disabled",
		);

		await act(async () => {
			resetLocalValues();
		});
		await vi.waitFor(() => {
			expect(container.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe(
				"Original",
			);
			expect(container.querySelector('[data-testid="values"]')?.textContent).toBe(
				"Original|4|24000|enabled",
			);
			expect(runtime.value).toBe("24");
		});
	});

	it("maps canonical schema issues to fields and submits only a valid item", async () => {
		submittedItems.length = 0;
		const container = await mount(createElement(ValidationHarness));
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');
		if (title === null || submit === null) throw new Error("Missing validation controls.");

		await changeInput(title, "");
		await act(async () => submit.click());
		expect(title.getAttribute("aria-invalid")).toBe("true");
		expect(submittedItems).toHaveLength(0);

		await changeInput(title, "Valid title");
		expect(title.getAttribute("aria-invalid")).toBeNull();
		await act(async () => submit.click());
		expect(submittedItems).toHaveLength(1);
		expect(submittedItems[0]?.title).toBe("Valid title");
	});
});

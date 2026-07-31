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
import { EditorItemFormSchema } from "~/engine/item/editor/schema/EditorItemFormSchema";
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
	await act(async () => {
		input.value = value;
		input.dispatchEvent(new Event("input", {
			bubbles: true,
		}));
	});
};

const LocalValueHarness = () => {
	const form = useAppForm({
		defaultValues: {
			amount: 4,
			tags: "resource, original",
		},
	});
	const values = useStore(form.store, (state) => state.values);
	return (
		<>
			<form.AppField name="tags">
				{(field) => <field.TagsField label="Tags" />}
			</form.AppField>
			<form.AppField name="amount">
				{(field) => <field.NumberField label="Amount" />}
			</form.AppField>
			<button
				type="button"
				onClick={() =>
					form.reset({
						amount: 4,
						tags: "resource, reset",
					})
				}
			>
				Reset
			</button>
			<output data-testid="values">
				{values.tags}|{Number.isNaN(values.amount) ? "NaN" : values.amount}
			</output>
		</>
	);
};

const submittedItems: EditorItem[] = [];

const ValidationHarness = () => {
	const form = useAppForm({
		defaultValues: {
			uid: "q12cmsx5ussy30wyjiea8yaw",
			id: "item:test",
			type: "simple" as const,
			title: "Test item",
			description: "A valid item used by the editor form test.",
			asset: {
				default: [
					"item-test",
				] as [string],
			},
			tags: "resource, form",
			categoryId: "resource",
			scope: "any" as const,
			maxStackSize: 1,
		},
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
	it("keeps raw tags in the form store and resets the visible value from that store", async () => {
		const container = await mount(createElement(LocalValueHarness));
		const inputs = container.querySelectorAll<HTMLInputElement>("input");
		const tags = inputs[0];
		const amount = inputs[1];
		if (tags === undefined || amount === undefined) throw new Error("Missing form inputs.");

		await changeInput(tags, "resource, changed,");
		await changeInput(amount, "");
		expect(container.querySelector('[data-testid="values"]')?.textContent).toBe(
			"resource, changed,|NaN",
		);

		await act(async () => {
			container.querySelector<HTMLButtonElement>("button")?.click();
		});
		expect(tags.value).toBe("resource, reset");
		expect(container.querySelector('[data-testid="values"]')?.textContent).toBe(
			"resource, reset|4",
		);
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
		expect(submittedItems[0]?.tags).toEqual([
			"resource",
			"form",
		]);
	});
});

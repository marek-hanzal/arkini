// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { OutputSchema } from "~/production-output/schema/OutputSchema";

vi.mock("~/item-authoring/ui/FormContext", () => ({
	useFormSession: () => ({
		outputSetIndex: 1,
		outputRollIndex: 2,
	}),
}));
vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => null,
	EditorItemSearchThumbnail: () => null,
}));
vi.mock("~/item-authoring/ui/useFormValidationIssues", () => ({
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
	useEditorItemSearchOptions: () => ({
		items: {},
		options: [],
	}),
}));
vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (text: string) => text,
	}),
}));
vi.mock("~/editor-control/ui/EditorSearchCombobox", () => ({
	EditorSearchCombobox: ({ label, value }: { label: string; value: string }) =>
		createElement(
			"output",
			{
				"data-label": label,
			},
			value,
		),
}));

import { OutputControl } from "~/production-authoring/ui/OutputControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("opens the requested output set and nested roll on first form render", async () => {
	const value = OutputSchema.parse({
		set: Array.from(
			{
				length: 2,
			},
			() => ({
				weight: 1,
				roll: Array.from(
					{
						length: 3,
					},
					() => ({
						type: "guaranteed" as const,
						drop: [
							{
								itemId: "material",
								quantity: {
									min: 1,
									max: 1,
								},
								placement: "drop",
								rules: [],
							},
						],
					}),
				),
			}),
		),
	});
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	try {
		await act(async () =>
			root.render(
				<OutputControl
					value={value}
					onChangeFn={() => {}}
				/>,
			),
		);
		expect(container.querySelector('[data-label="Output sets"]')?.textContent).toBe("1");
		expect(container.querySelector('[data-label="Output set 2 rolls"]')?.textContent).toBe("2");
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

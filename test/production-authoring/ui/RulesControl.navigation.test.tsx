// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { RuleSchema } from "~/production-line/schema/RuleSchema";

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: {},
		},
	}),
}));

vi.mock("~/item-authoring/ui/useFormValidationIssues", () => ({
	useFormValidationFocusIndex: () => undefined,
	useFormValidationIssues: () => [],
}));
vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (text: string) => text,
	}),
}));
vi.mock("~/translation/ui/Mx", () => ({
	Mx: ({ label }: { label: string }) => createElement("span", null, label),
}));
vi.mock("~/authoring-form/ui/useEditorItemSearchOptions", () => ({
	useEditorItemOptionLabel: () => (itemUid: string, fallback: string) => itemUid || fallback,
}));
vi.mock("~/production-authoring/ui/SelectorControl", () => ({
	SelectorControl: () => null,
}));

import { RulesControl } from "~/production-authoring/ui/RulesControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("preserves the selected query when changing a condition kind", async () => {
	const query = {
		distance: "far" as const,
		selector: {
			type: "item" as const,
			itemUid: "selected-item",
		},
	};
	const rules: RuleSchema.Type[] = [
		{
			type: "enable",
			when: [
				{
					type: "range",
					min: 2,
					max: 4,
					query,
				},
			],
		},
	];
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const onChangeFn = vi.fn();
	try {
		await act(async () =>
			root.render(
				<RulesControl
					allowedTypes={[
						"enable",
						"disable",
					]}
					description={null}
					onChangeFn={onChangeFn}
					rules={rules}
					target="line"
				/>,
			),
		);
		const exact = Array.from(
			container.querySelectorAll<HTMLButtonElement>('[data-ui="EditorChoiceControlOption"]'),
		).find((button) => button.textContent?.trim() === "Exact count");
		if (exact === undefined) throw new Error("Missing Exact count choice.");
		await act(async () => exact.click());
		expect(onChangeFn).toHaveBeenCalledWith([
			{
				type: "enable",
				when: [
					{
						type: "count",
						count: 1,
						query,
					},
				],
			},
		]);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorSelect } from "~/editor-control/ui/EditorSelect";

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

describe("EditorSelect", () => {
	it("keeps disabled options visible without selecting them", async () => {
		const onChange = vi.fn();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				<EditorSelect
					label="Version"
					onChangeFn={onChange}
					options={[
						{
							label: "Working copy",
							value: "current",
						},
						{
							disabled: true,
							label: "Old game version",
							value: "old",
						},
					]}
					value="current"
				/>,
			);
		});

		const trigger = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorSelectTrigger"]',
		);
		if (trigger === null) throw new Error("Missing editor select trigger.");
		await act(async () => trigger.click());
		const disabledOption = Array.from(
			document.querySelectorAll<HTMLButtonElement>('[data-ui="EditorSelectOption"]'),
		).find((option) => option.textContent?.includes("Old game version"));
		if (disabledOption === undefined) throw new Error("Missing disabled editor select option.");

		expect(disabledOption.disabled).toBe(true);
		await act(async () => disabledOption.click());
		expect(onChange).not.toHaveBeenCalled();
	});
});

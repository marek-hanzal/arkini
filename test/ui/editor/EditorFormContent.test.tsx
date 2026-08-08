// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorFormContent } from "~/ui/form/EditorFormContent";

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

describe("EditorFormContent", () => {
	it("owns the single root card for an editor form", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const save = vi.fn(async () => true);

		await act(async () =>
			root.render(
				createElement(
					EditorFormContent,
					{
						error: undefined,
						save,
					},
					createElement("input", {
						name: "title",
					}),
				),
			),
		);

		expect(container.querySelectorAll('[data-ui="EditorFormCard"]')).toHaveLength(1);
		expect(
			container.querySelector('[data-ui="EditorFormCard"] input[name="title"]'),
		).not.toBeNull();

		await act(async () => {
			container.querySelector("form")?.dispatchEvent(
				new Event("submit", {
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(save).toHaveBeenCalledOnce();
	});
});

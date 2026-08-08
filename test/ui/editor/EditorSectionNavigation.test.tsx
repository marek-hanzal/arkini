// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { editorBackLinkClassName, EditorBackIcon } from "~/ui/editor/EditorBackIcon";
import { EditorSectionNavigation } from "~/ui/editor/EditorSectionNavigation";

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const render = async (node: ReactNode) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => root.render(node));
	return container;
};

describe("editor section navigation", () => {
	it("keeps back and local tabs before the separated page title", async () => {
		const container = await render(
			<EditorSectionNavigation
				leading={<span data-ui="Leading" />}
				tabs={<span data-ui="Tabs" />}
				title={<span data-ui="Title" />}
				action={<span data-ui="Action" />}
			/>,
		);
		const navigation = container.querySelector('[data-ui="EditorSectionNavigation"]');
		expect(
			[
				...(navigation?.children ?? []),
			].map((child) => child.getAttribute("data-ui")),
		).toEqual([
			"Leading",
			"EditorSectionNavigationTabs",
			"EditorSectionNavigationSeparator",
			"EditorSectionNavigationTitle",
			"EditorSectionNavigationAction",
		]);
	});

	it("renders the shared back cue as one large unframed icon", async () => {
		const container = await render(<EditorBackIcon />);
		expect(container.querySelector("span")?.className).toContain("size-7");
		expect(editorBackLinkClassName).toContain("border-0");
		expect(editorBackLinkClassName).toContain("bg-transparent");
		expect(editorBackLinkClassName).toContain("shadow-none");
	});
});

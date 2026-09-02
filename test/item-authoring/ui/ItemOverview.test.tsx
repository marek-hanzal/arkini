// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { project } = vi.hoisted(() => ({
	project: {
		config: {},
		projectId: "project-one",
		revision: 1,
	},
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => project,
}));

vi.mock("~/estimate/ui/useItemEstimate", () => ({
	useItemEstimate: () => ({
		estimate: {
			durationMs: 2_000,
			obtainable: true,
		},
		status: "ready",
	}),
}));

vi.mock("~/item-authoring/fn/readDeleteBlockersFn", () => ({
	readDeleteBlockersFn: () => [],
}));

vi.mock("~/item-authoring/fn/readRequiredByItemsFn", () => ({
	readRequiredByItemsFn: () => [],
}));

vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => createElement("span"),
}));

vi.mock("~/ui/ui/LinkButton", () => ({
	LinkButtonLink: ({ children, params, to, ...props }: Record<string, unknown>) =>
		createElement(
			"a",
			{
				...props,
				"data-params": JSON.stringify(params),
				"data-to": to,
			},
			children as ReactNode,
		),
}));

import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";
import { ItemOverview } from "~/item-authoring/ui/ItemOverview";

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

describe("ItemOverview", () => {
	it("links every available overview card to its matching item detail section", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(<ItemOverview item={editorTestConfig.items.water} />);
		});

		const links = Array.from(
			container.querySelectorAll<HTMLAnchorElement>('[data-ui="EditorItemOverviewLink"]'),
		);
		expect(links.map((link) => link.dataset.sectionId)).toEqual([
			"artwork",
			"charges",
			"merges",
			"estimate",
			"required-by",
			"delete",
		]);
		for (const link of links) {
			expect(link.dataset.to).toBe(
				"/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
			);
			expect(JSON.parse(link.dataset.params ?? "null")).toEqual({
				itemUid: editorTestConfig.items.water.uid,
				projectId: project.projectId,
				sectionId: link.dataset.sectionId,
			});
		}
	});
});

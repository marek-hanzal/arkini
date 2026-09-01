// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: {
				consumer: {
					asset: {
						default: [],
					},
					id: "consumer",
					title: "Consumer",
					uid: "consumer-uid",
				},
			},
		},
		projectId: "project-one",
	}),
}));

vi.mock("~/flow/fn/createAcquisitionGraphFn", () => ({
	createAcquisitionGraphFn: () => ({
		routes: [],
	}),
}));

vi.mock("~/flow/fn/readRequiredByFactIdsFn", () => ({
	readRequiredByFactIdsFn: () => [
		"consumer",
	],
}));

vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => createElement("span"),
}));

vi.mock("~/ui/ui/Button", () => ({
	ButtonLink: ({ children, params, to, ...props }: Record<string, unknown>) =>
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

import { RequiredBySection } from "~/item-authoring/ui/RequiredBySection";

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

describe("RequiredBySection", () => {
	it("keeps navigation on Required by for the selected consumer", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(<RequiredBySection itemId="material" />);
		});

		const link = container.querySelector<HTMLAnchorElement>("a");
		expect(link?.dataset.to).toBe("/editor/$projectId/editor/items/$itemUid/detail/$sectionId");
		expect(JSON.parse(link?.dataset.params ?? "null")).toEqual({
			itemUid: "consumer-uid",
			projectId: "project-one",
			sectionId: "required-by",
		});
	});
});

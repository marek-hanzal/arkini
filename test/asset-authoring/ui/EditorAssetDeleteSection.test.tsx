// @vitest-environment jsdom

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/project-authoring/type/EditorProject";

const state = vi.hoisted(() => ({
	navigate: vi.fn().mockResolvedValue(undefined),
	project: undefined as EditorProject | undefined,
	remove: vi.fn().mockResolvedValue(undefined),
	result: undefined as unknown,
}));

vi.mock("@effect/atom-react", () => ({
	scheduleTask: vi.fn(),
	useAtomSet: () => state.remove,
	useAtomValue: () => state.result,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const original = await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...original,
		useNavigate: () => state.navigate,
	};
});

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () =>
		createElement("span", {
			"data-ui": "EditorItemThumbnail",
		}),
}));

vi.mock("~/ui/button/Button", () => {
	const Button = ({ children, cursorIntent: _cursorIntent, ...props }: Record<string, unknown>) =>
		createElement("button", props, children as ReactNode);
	return {
		Button,
		DangerButton: Button,
		ButtonLink: ({ children, params, search, to, ...props }: Record<string, unknown>) =>
			createElement(
				"a",
				{
					...props,
					"data-params": JSON.stringify(params),
					"data-search": JSON.stringify(search),
					"data-to": to,
				},
				children as ReactNode,
			),
	};
});

import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { EditorAssetDeleteSection } from "~/asset-authoring/ui/EditorAssetDeleteSection";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	vi.clearAllMocks();
	state.result = AsyncResult.initial();
	state.project = {
		projectId: "project-one",
		title: editorTestPayload.config.meta.title,
		version: "1.0",
		createdAtMs: 1,
		updatedAtMs: 1,
		revision: 0,
		config: editorTestPayload.config,
		resources: [
			...editorTestPayload.resources,
			{
				id: "unused",
				mime: "image/png",
				bytes: Uint8Array.of(9),
			},
		],
	};
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const render = async (resourceId: string) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			<EditorAssetDeleteSection
				filter="unused"
				query="spare"
				resourceId={resourceId}
			/>,
		);
	});
	return container;
};

describe("EditorAssetDeleteSection", () => {
	it("confirms an eligible delete and replaces the dead detail with the asset list", async () => {
		const project = state.project;
		if (project === undefined) throw new Error("Expected editor project fixture.");
		state.project = {
			...project,
			projectId: "project/one",
			resources: project.resources.map((resource) =>
				resource.id === "unused"
					? {
							...resource,
							id: "unused/asset",
						}
					: resource,
			),
		};
		const container = await render("unused/asset");
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>('[data-ui="EditorAssetDeleteOpen"]')
				?.click(),
		);
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>('[data-ui="EditorAssetDeleteConfirm"]')
				?.click(),
		);

		expect(state.remove).toHaveBeenCalledWith({
			expectedRevision: 0,
			resourceId: "unused/asset",
		});
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/assets",
			params: {
				projectId: "project/one",
			},
			search: {
				filter: "unused",
				query: "spare",
			},
			replace: true,
		});
	});
});

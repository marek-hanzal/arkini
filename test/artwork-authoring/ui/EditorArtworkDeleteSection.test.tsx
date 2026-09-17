// @vitest-environment jsdom

import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "~/project-authoring/type/Project";

const state = vi.hoisted(() => ({
	navigate: vi.fn().mockResolvedValue(undefined),
	project: undefined as Project | undefined,
	remove: vi.fn(async ({ onDeletedFn }: { readonly onDeletedFn: () => Promise<void> }) =>
		onDeletedFn(),
	),
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

vi.mock("~/ui/ui/Button", () => {
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

import {
	editorTestResources,
	editorTestPayload,
} from "~test/project-authoring/support/editorTestPayload";
import { EditorArtworkDeleteSection } from "~/artwork-authoring/ui/EditorArtworkDeleteSection";

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
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 1,
		updatedAtMs: 1,
		revision: 0,
		config: editorTestPayload.config,
		resources: [
			...editorTestResources,
			{
				id: "unused",
				type: "artwork",
				size: 1,
				version: "1",
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
			<TranslationTestProvider>
				<EditorArtworkDeleteSection
					filter="unused"
					query="spare"
					resourceId={resourceId}
				/>
			</TranslationTestProvider>,
		);
	});
	return container;
};

describe("EditorArtworkDeleteSection", () => {
	it("confirms an eligible delete and replaces the dead detail with the artwork list", async () => {
		const project = state.project;
		if (project === undefined) throw new Error("Expected editor project fixture.");
		state.project = {
			...project,
			projectId: "project/one",
			resources: project.resources.map((resource) =>
				resource.id === "unused"
					? {
							...resource,
							id: "unused/artwork",
						}
					: resource,
			),
		};
		const container = await render("unused/artwork");
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>('[data-ui="EditorArtworkDeleteOpen"]')
				?.click(),
		);
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>('[data-ui="EditorArtworkDeleteConfirm"]')
				?.click(),
		);

		expect(state.remove).toHaveBeenCalledWith({
			expectedRevision: 0,
			resourceId: "unused/artwork",
			onDeletedFn: expect.any(Function),
		});
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/artwork",
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

// @vitest-environment jsdom

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";

const state = vi.hoisted(() => ({
	historyBack: vi.fn(() => false),
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

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/bridge/item/editor/deleteEditorItemCommandAtom", () => ({
	deleteEditorItemCommandAtom: () => ({
		id: "delete-editor-item",
	}),
}));

vi.mock("~/ui/editor/useEditorHistoryBack", () => ({
	useEditorHistoryBack: () => state.historyBack,
}));

vi.mock("~/ui/button/Button", () => {
	const Button = ({ children, cursorIntent: _cursorIntent, ...props }: Record<string, unknown>) =>
		createElement("button", props, children as ReactNode);
	return {
		Button,
		DangerButton: Button,
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
	};
});

import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { EditorItemDeleteSection } from "~/ui/item/editor/EditorItemDeleteSection";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	vi.clearAllMocks();
	state.historyBack.mockReturnValue(false);
	state.result = AsyncResult.initial();
	state.project = {
		projectId: "project-one",
		title: editorTestPayload.config.meta.title,
		version: "1.0",
		createdAtMs: 1,
		updatedAtMs: 1,
		revision: 0,
		config: editorTestPayload.config,
		resources: editorTestPayload.resources,
	};
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const render = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(<EditorItemDeleteSection item={editorTestPayload.config.items.water} />);
	});
	return container;
};

const makeItemEligible = () => {
	const project = state.project;
	if (project === undefined) throw new Error("Expected editor project fixture.");
	state.project = {
		...project,
		config: {
			...project.config,
			start: {
				...project.config.start,
				board: [],
			},
		},
	};
};

const confirmDelete = async (container: HTMLElement) => {
	await act(async () =>
		container.querySelector<HTMLButtonElement>('[data-ui="EditorItemDeleteOpen"]')?.click(),
	);
	await act(async () =>
		container.querySelector<HTMLButtonElement>('[data-ui="EditorItemDeleteConfirm"]')?.click(),
	);
};

describe("EditorItemDeleteSection", () => {
	it("links a blocking start reference to its exact project section", async () => {
		const container = await render();
		const link = container.querySelector<HTMLAnchorElement>(
			'[data-to="/editor/$projectId/project/$sectionId"]',
		);

		expect(container.textContent).toContain("This item cannot be deleted yet");
		expect(container.textContent).toContain("Initial board references this item");
		expect(link?.dataset.params).toBe(
			JSON.stringify({
				projectId: "project-one",
				sectionId: "board",
			}),
		);
		expect(container.querySelector('[data-ui="EditorItemDeleteOpen"]')).toBeNull();
		expect(container.querySelector('[data-ui="EditorItemForceDeleteOpen"]')).not.toBeNull();
	});

	it("explains and confirms the destructive force-delete impact", async () => {
		const container = await render();

		await act(async () =>
			container
				.querySelector<HTMLButtonElement>('[data-ui="EditorItemForceDeleteOpen"]')
				?.click(),
		);

		expect(container.textContent).toContain("Remove 1 starting board entry");
		expect(container.textContent).toContain("Its asset files remain available in the project.");
		expect(container.textContent).toContain(
			"The resulting config will remain structurally valid",
		);
		expect(container.textContent).toContain("the game can be logically broken");
		expect(container.textContent).toContain(
			"No additional references or gameplay relationships",
		);
		expect(container.textContent).toContain("every saved Board scenario");
		expect(container.textContent).toContain("published game saves are discarded");

		await act(async () =>
			container
				.querySelector<HTMLButtonElement>('[data-ui="EditorItemDeleteConfirm"]')
				?.click(),
		);

		expect(state.remove).toHaveBeenCalledWith({
			expectedRevision: 0,
			force: true,
			itemUid: "water",
		});
	});

	it("confirms an eligible delete and replaces a direct deep-link fallback", async () => {
		makeItemEligible();
		const container = await render();
		const open = container.querySelector<HTMLButtonElement>('[data-ui="EditorItemDeleteOpen"]');
		expect(container.textContent).toContain("This item can be deleted");

		await act(async () => open?.click());
		expect(container.textContent).toContain("Its asset files remain available in the project.");
		expect(container.textContent).toContain("every saved Board scenario");
		expect(container.textContent).toContain("published game saves are discarded");
		const confirm = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorItemDeleteConfirm"]',
		);
		await act(async () => confirm?.click());

		expect(state.remove).toHaveBeenCalledWith({
			expectedRevision: 0,
			force: false,
			itemUid: "water",
		});
		expect(state.historyBack).toHaveBeenCalledOnce();
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/editor/items/list",
			params: {
				projectId: "project-one",
			},
			replace: true,
		});
	});

	it("returns through browser history when the item came from a stateful list", async () => {
		makeItemEligible();
		state.historyBack.mockReturnValue(true);
		const container = await render();

		await confirmDelete(container);

		expect(state.remove).toHaveBeenCalledOnce();
		expect(state.historyBack).toHaveBeenCalledOnce();
		expect(state.navigate).not.toHaveBeenCalled();
	});
});

// @vitest-environment jsdom

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/editor/EditorProject";

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

vi.mock("~/ui/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
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

describe("EditorItemDeleteSection", () => {
	it("submits the exact revision-scoped force delete", async () => {
		const container = await render();

		await act(async () =>
			container
				.querySelector<HTMLButtonElement>('[data-ui="EditorItemForceDeleteOpen"]')
				?.click(),
		);

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
		if (open === null) throw new Error("Missing delete action.");

		await act(async () => open.click());
		const confirm = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorItemDeleteConfirm"]',
		);
		if (confirm === null) throw new Error("Missing delete confirmation.");
		await act(async () => confirm.click());

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
});

import { TranslationTestProvider } from "~test/support/TranslationTestProvider";
// @vitest-environment jsdom

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "~/project-authoring/type/Project";

const state = vi.hoisted(() => ({
	project: undefined as Project | undefined,
	result: undefined as unknown,
	save: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@effect/atom-react", () => ({
	scheduleTask: vi.fn(),
	useAtomSet: () => state.save,
	useAtomValue: () => state.result,
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/ui/ui/Button", () => {
	const createButtonFn =
		(variant: string) =>
		({ children, cursorIntent: _cursorIntent, ...props }: Record<string, unknown>) =>
			createElement(
				"button",
				{
					...props,
					"data-variant": variant,
				},
				children as ReactNode,
			);
	return {
		Button: createButtonFn("default"),
		PrimaryButton: createButtonFn("primary"),
	};
});

import { ItemDraftToggle } from "~/item-authoring/ui/ItemDraftToggle";
import {
	editorTestResources,
	editorTestPayload,
} from "~test/project-authoring/support/editorTestPayload";

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
		projectId: "draft-project",
		title: editorTestPayload.config.meta.title,
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 1,
		updatedAtMs: 2,
		revision: 7,
		config: editorTestPayload.config,
		resources: editorTestResources,
	};
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("ItemDraftToggle", () => {
	it("persists the inverse at the current revision without optimistic projection", async () => {
		const item = editorTestPayload.config.items.water;
		if (item === undefined) throw new Error("Missing item fixture.");
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const renderFn = async (candidate = item) => {
			await act(async () => {
				root.render(
					<TranslationTestProvider>
						<ItemDraftToggle item={candidate} />
					</TranslationTestProvider>,
				);
			});
		};
		await renderFn();
		const readButtonFn = () =>
			container.querySelector<HTMLButtonElement>('[data-ui="EditorItemDraftToggle"]');
		const button = readButtonFn();
		if (button === null) throw new Error("Missing draft toggle.");

		expect(button.dataset.uiActive).toBe("false");
		expect(button.dataset.variant).toBe("default");
		await act(async () => button.click());
		expect(state.save).toHaveBeenCalledWith({
			config: state.project?.config,
			draft: true,
			expectedRevision: 7,
			itemId: item.id,
		});

		state.result = AsyncResult.fail(new Error("Write failed"), {
			waiting: true,
		});
		await renderFn();
		expect(button.disabled).toBe(true);
		expect(button.dataset.uiActive).toBe("false");
		expect(container.querySelector('[data-ui="EditorItemDraftError"]')).toBeNull();

		state.result = AsyncResult.fail(new Error("Write failed"));
		await renderFn();
		expect(button.disabled).toBe(false);
		expect(container.textContent).toContain("Write failed");

		state.result = AsyncResult.initial();
		await renderFn({
			...item,
			draft: true,
		});
		expect(readButtonFn()?.dataset.uiActive).toBe("true");
		expect(readButtonFn()?.dataset.variant).toBe("primary");
	});
});

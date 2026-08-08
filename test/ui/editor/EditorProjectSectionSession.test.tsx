// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@effect/atom-react", () => ({
	useAtomSet: () => vi.fn(),
	useAtomValue: () => undefined,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const original = await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...original,
		useNavigate: () => vi.fn().mockResolvedValue(undefined),
	};
});

vi.mock("~/ui/button/Button", () => ({
	ButtonLink: ({ children }: { readonly children?: ReactNode }) =>
		createElement("a", null, children),
	PrimaryButton: ({ children }: { readonly children?: ReactNode }) =>
		createElement("button", null, children),
}));

const state = vi.hoisted(() => ({
	project: undefined as unknown,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/bridge/project/editor/saveEditorProjectConfigCommandAtom", () => ({
	saveEditorProjectConfigCommandAtom: () => ({
		id: "save-editor-project",
	}),
}));

vi.mock("~/ui/reactivity/readSettledAsyncResultError", () => ({
	readSettledAsyncResultError: () => undefined,
}));

vi.mock("~/ui/resource/editor/EditorAssetAutocompleteField", () => ({
	EditorAssetAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

vi.mock("~/ui/item/editor/EditorItemAutocompleteField", () => ({
	EditorItemAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectForm } from "~/ui/project/editor/EditorProjectForm";
import { EditorProjectGeneralSection } from "~/ui/project/editor/EditorProjectGeneralSection";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

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

const changeInput = async (input: HTMLInputElement, value: string) => {
	const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (valueSetter === undefined) throw new Error("Expected native input value setter.");
	await act(async () => {
		valueSetter.call(input, value);
		input.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

describe("project section form session", () => {
	it("preserves one local project draft while routed section content changes", async () => {
		state.project = {
			projectId: "project",
			title: editorTestPayload.config.meta.title,
			game: editorTestPayload.config.version,
			createdAtMs: 1,
			updatedAtMs: 2,
			revision: 0,
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		} satisfies EditorProject;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const renderSection = async (section: ReactNode) => {
			await act(async () => {
				root.render(<EditorProjectForm>{section}</EditorProjectForm>);
			});
		};

		await renderSection(<EditorProjectGeneralSection />);
		const navigation = container.querySelector('[data-ui="EditorSectionNavigation"]');
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing project title input.");
		await changeInput(title, "Changed project");
		await renderSection(<div data-ui="AppearanceSection">Appearance</div>);
		await renderSection(<EditorProjectGeneralSection />);

		expect(container.querySelector('[data-ui="EditorSectionNavigation"]')).toBe(navigation);
		expect(container.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe(
			"Changed project",
		);
	});
});

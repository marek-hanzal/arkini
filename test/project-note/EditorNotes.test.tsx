// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/ui/editor/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "project-one",
	}),
}));
vi.mock("~/project-note/workspace/EditorNotesCommandAtoms", async () => {
	const { EditorNotesTestCommandAtoms } = await import(
		"~test/project-note/EditorNotes.test/fixture"
	);
	return {
		EditorNotesCommandAtoms: EditorNotesTestCommandAtoms,
	};
});
vi.mock("~/ui/overlay/Tooltip", () => ({
	Tooltip: ({
		children,
		content,
	}: {
		readonly children: React.ReactNode;
		readonly content: string;
	}) => <span data-tooltip={content}>{children}</span>,
}));
vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

import { Route as EditorNotesRouteDefinition } from "~/@routes/editor/$projectId/notes";
import { editorNotesTestState as state } from "~test/project-note/EditorNotes.test/fixture";

const EditorNotes = EditorNotesRouteDefinition.options.component;
if (EditorNotes === undefined) throw new Error("Editor Notes route component is missing.");

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: Array<AtomRegistry.AtomRegistry> = [];

beforeEach(() => {
	state.createFailures = 0;
	state.nextNote = 2;
	state.notes = [
		{
			noteId: "note-one",
			projectId: "project-one",
			content: "Existing note",
			createdAtMs: 1,
			updatedAtMs: 1,
		},
	];
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	for (const registry of registries.splice(0)) registry.dispose();
});

const renderNotes = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	await act(async () =>
		root.render(
			createElement(
				RegistryContext.Provider,
				{
					value: registry,
				},
				createElement(EditorNotes),
			),
		),
	);
	return container;
};

const changeTextarea = async (textarea: HTMLTextAreaElement, value: string) => {
	await act(async () => {
		const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
		if (setter === undefined) throw new Error("Textarea value setter is unavailable.");
		setter.call(textarea, value);
		textarea.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

const click = async (element: Element | null) => {
	if (!(element instanceof HTMLElement)) throw new Error("Expected a clickable element.");
	await act(async () => element.click());
};

describe("EditorNotes", () => {
	it("persists a new note into the live stream", async () => {
		const container = await renderNotes();
		await act(async () =>
			vi.waitFor(() => expect(container.textContent).toContain("Existing note")),
		);
		const composer = container.querySelector<HTMLTextAreaElement>("textarea");
		if (composer === null) throw new Error("Missing note composer.");
		await changeTextarea(composer, "New note");
		await click(
			[
				...container.querySelectorAll("button"),
			].find((button) => button.textContent === "Create note") ?? null,
		);
		await act(async () =>
			vi.waitFor(() => expect(container.textContent).toContain("New note")),
		);
	});

	it("keeps a failed create draft available for retry", async () => {
		state.createFailures = 1;
		const container = await renderNotes();
		await act(async () =>
			vi.waitFor(() => expect(container.textContent).toContain("Existing note")),
		);
		const composer = container.querySelector<HTMLTextAreaElement>("textarea");
		if (composer === null) throw new Error("Missing note composer.");
		await changeTextarea(composer, "Retry me");
		const createButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Create note");

		await click(createButton ?? null);
		await act(async () =>
			vi.waitFor(() => expect(container.textContent).toContain("Note could not be saved.")),
		);
		expect(composer.value).toBe("Retry me");

		await click(createButton ?? null);
		await act(async () =>
			vi.waitFor(() => expect(container.textContent).toContain("Retry me")),
		);
		expect(composer.value).toBe("");
	});
});

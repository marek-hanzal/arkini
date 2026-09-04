// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "project-one",
	}),
}));
vi.mock("~/project-note/atom/NoteCommandAtoms", async () => {
	const { EditorNotesTestCommandAtoms } = await import(
		"~test/project-note/support/EditorNotesFixture"
	);
	return {
		NoteCommandAtoms: EditorNotesTestCommandAtoms,
	};
});
vi.mock("~/authoring-shell/ui/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: () => null,
}));
vi.mock("~/ui/ui/Tooltip", () => ({
	Tooltip: ({
		children,
		content,
	}: {
		readonly children: React.ReactNode;
		readonly content: React.ReactNode;
	}) => (
		<span>
			{children}
			<span hidden>{content}</span>
		</span>
	),
}));
vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

import { Route as EditorNotesRouteDefinition } from "~/@routes/editor/$projectId/notes";
import { editorNotesTestState as state } from "~test/project-note/support/EditorNotesFixture";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

const EditorNotes = EditorNotesRouteDefinition.options.component;
if (EditorNotes === undefined) throw new Error("Editor Notes route component is missing.");

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: Array<AtomRegistry.AtomRegistry> = [];
let projectChangedFn: ((projectId: string) => void) | undefined;

beforeEach(() => {
	projectChangedFn = undefined;
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			editor: {
				onProjectChangedFn: (listenerFn: (projectId: string) => void) => {
					projectChangedFn = listenerFn;
					return () => {
						projectChangedFn = undefined;
					};
				},
			},
		},
	});
	state.createFailures = 0;
	state.listFailures = 0;
	state.beforeCreateFn = undefined;
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
	Reflect.deleteProperty(window, "arkini");
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
				TranslationTestProvider,
				null,
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(EditorNotes),
				),
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
	it("clears an initial Notes read failure after explicit Retry succeeds", async () => {
		state.listFailures = 1;
		const container = await renderNotes();
		expect(container.textContent).toContain("Notes could not be loaded.");
		await click(
			[
				...container.querySelectorAll("button"),
			].find((button) => button.textContent === "Retry loading notes") ?? null,
		);
		expect(container.textContent).toContain("Existing note");
		expect(container.textContent).not.toContain("Notes could not be loaded.");
	});

	it.each([
		false,
		true,
	])("settles create before MCP refresh and retains failure: %s", async (failCreate) => {
		state.createFailures = failCreate ? 1 : 0;
		let completeCreateFn: (() => void) | undefined;
		const createGate = new Promise<void>((resolveFn) => {
			completeCreateFn = resolveFn;
		});
		state.beforeCreateFn = () => createGate;
		const container = await renderNotes();
		const composer = container.querySelector<HTMLTextAreaElement>("textarea");
		if (composer === null) throw new Error("Missing note composer.");
		await changeTextarea(composer, "Pending note");
		const createButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Create note");
		await click(createButton ?? null);
		await act(async () => projectChangedFn?.("project-one"));

		expect(composer.value).toBe("Pending note");
		expect(createButton?.disabled).toBe(true);
		expect(state.notes).toHaveLength(1);

		await act(async () => completeCreateFn?.());
		if (failCreate) {
			expect(composer.value).toBe("Pending note");
			expect(container.textContent).toContain("Note could not be saved.");
			expect(state.notes).toHaveLength(1);
			return;
		}
		expect(state.notes[0]?.content).toBe("Pending note");
		expect(container.querySelector('[data-ui="EditorNote"]')?.textContent).toContain(
			"Pending note",
		);
		expect(composer.value).toBe("");
	});

	it("renders stored note content as Markdown without embedded HTML", async () => {
		state.notes[0] = {
			...state.notes[0],
			content:
				"**Bold idea**\n\n- First thought\n- Second thought\n\n<script>unsafe</script>",
		};
		const container = await renderNotes();
		await act(async () =>
			vi.waitFor(() => expect(container.textContent).toContain("Bold idea")),
		);

		const markdown = container.querySelector('[data-ui="EditorNote"] [data-ui="Markdown"]');
		expect(markdown?.querySelector("strong")?.textContent).toBe("Bold idea");
		expect(
			[
				...container.querySelectorAll('[data-ui="EditorNote"] li'),
			].map((item) => item.textContent),
		).toEqual([
			"First thought",
			"Second thought",
		]);
		expect(markdown?.querySelector("script")).toBeNull();
	});

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

	it("preserves a local edit draft on MCP refresh and closes it when the note disappears", async () => {
		const container = await renderNotes();
		await act(async () =>
			vi.waitFor(() => expect(container.textContent).toContain("Existing note")),
		);
		const editTooltip = [
			...container.querySelectorAll("span[hidden]"),
		].find((element) => element.textContent === "Edit");
		await click(editTooltip?.parentElement?.querySelector("button") ?? null);
		const editor = container.querySelector<HTMLTextAreaElement>(
			'[data-ui="EditorNote"] textarea',
		);
		if (editor === null) throw new Error("Missing note editor.");
		await changeTextarea(editor, "Local draft");

		state.notes = [
			{
				...state.notes[0],
				content: "MCP update",
				updatedAtMs: 2,
			},
		];
		await act(async () => projectChangedFn?.("project-one"));
		await act(async () =>
			vi.waitFor(() => {
				expect(editor.value).toBe("Local draft");
				const saveButton = [
					...container.querySelectorAll<HTMLButtonElement>("button"),
				].find((button) => button.parentElement?.textContent === "Save");
				expect(saveButton?.disabled).toBe(false);
			}),
		);

		const saveTooltip = [
			...container.querySelectorAll("span[hidden]"),
		].find((element) => element.textContent === "Save");
		await click(saveTooltip?.parentElement?.querySelector("button") ?? null);
		await act(async () =>
			vi.waitFor(() =>
				expect(container.textContent).toContain(
					"Editor note note-one changed after it was read.",
				),
			),
		);
		expect(editor.value).toBe("Local draft");

		state.notes = [];
		await act(async () => projectChangedFn?.("project-one"));
		await act(async () =>
			vi.waitFor(() => {
				expect(container.querySelector('[data-ui="EditorNote"]')).toBeNull();
				expect(container.textContent).toContain("Notes empty title");
			}),
		);
	});
});

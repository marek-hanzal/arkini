// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/project-note/atom/NoteCommandAtoms", async () => {
	const { EditorNotesTestCommandAtoms } = await import(
		"~test/project-note/support/EditorNotesFixture"
	);
	return {
		NoteCommandAtoms: EditorNotesTestCommandAtoms,
	};
});
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

import { ProjectNotesOverview } from "~/project-note/ui/ProjectNotesOverview";
import { editorNotesTestState as state } from "~test/project-note/support/EditorNotesFixture";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

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
	state.notes = [
		{
			noteId: "note-newest",
			projectId: "project-one",
			content: "**Newest idea**",
			createdAtMs: 2,
			updatedAtMs: 2,
		},
		{
			noteId: "note-older",
			projectId: "project-one",
			content: "Older idea",
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

const renderOverview = async () => {
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
					createElement(ProjectNotesOverview, {
						projectId: "project-one",
					}),
				),
			),
		),
	);
	return container;
};

describe("ProjectNotesOverview", () => {
	it("renders and refreshes the newest note as dated Markdown", async () => {
		const container = await renderOverview();
		await act(async () =>
			vi.waitFor(() =>
				expect(container.querySelector('[data-ui="Markdown"] strong')?.textContent).toBe(
					"Newest idea",
				),
			),
		);
		expect(container.querySelector("time")?.dateTime).toBe(new Date(2).toISOString());
		expect(container.textContent).not.toContain("Older idea");
		const notesLink = container.querySelector<HTMLAnchorElement>('[data-overview-id="notes"]');
		expect(notesLink?.dataset.to).toBe("/editor/$projectId/notes");
		expect(JSON.parse(notesLink?.dataset.params ?? "null")).toEqual({
			projectId: "project-one",
		});

		state.notes = [
			{
				...state.notes[0],
				content: "# MCP idea",
				updatedAtMs: 3,
			},
		];
		await act(async () => projectChangedFn?.("project-one"));
		await act(async () =>
			vi.waitFor(() =>
				expect(container.querySelector('[data-ui="Markdown"] h1')?.textContent).toBe(
					"MCP idea",
				),
			),
		);
		expect(container.querySelector("time")?.dateTime).toBe(new Date(3).toISOString());
	});
});

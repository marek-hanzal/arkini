// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/authoring-session/ui/useEditorProject", async () => {
	const { editorNotesTestProject } = await import(
		"~test/project-note/support/EditorNotesFixture"
	);
	return {
		useEditorProject: () => editorNotesTestProject,
	};
});
vi.mock("~/project-note/atom/NoteCommandAtoms", async () => {
	const { EditorNotesTestCommandAtoms } = await import(
		"~test/project-note/support/EditorNotesFixture"
	);
	return {
		NoteCommandAtoms: EditorNotesTestCommandAtoms,
	};
});
vi.mock("~/authoring-session/ui/ResourceUrlSession", () => ({
	useResourceUrl: () => undefined,
}));
vi.mock("~/authoring-shell/ui/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: () => null,
}));
vi.mock("~/ui/ui/Button", async (importOriginalFn) => ({
	...(await importOriginalFn<typeof import("~/ui/ui/Button")>()),
	ButtonLink: ({ children, params, search, to, ...props }: Record<string, unknown>) =>
		createElement(
			"a",
			{
				...props,
				href: String(to)
					.replace("$projectId", (params as Record<string, string>).projectId)
					.replace("$resourceId", (params as Record<string, string>).resourceId),
				"data-search": JSON.stringify(search),
			},
			children as ReactNode,
		),
}));
vi.mock("@tanstack/react-router", async (importOriginalFn) => ({
	...(await importOriginalFn<typeof import("@tanstack/react-router")>()),
	Link: ({ children }: { readonly children: ReactNode }) => createElement("a", {}, children),
}));
vi.mock("~/ui/ui/Tooltip", () => ({
	Tooltip: ({ children }: { readonly children: ReactNode }) => children,
}));
vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

import { Route as AssetNotesRoute } from "~/@routes/editor/$projectId/assets/$resourceId/detail/notes";
import { Route as GlobalNotesRoute } from "~/@routes/editor/$projectId/notes";
import { editorNotesTestState as state } from "~test/project-note/support/EditorNotesFixture";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: Array<AtomRegistry.AtomRegistry> = [];

beforeEach(() => {
	vi.spyOn(AssetNotesRoute, "useParams").mockReturnValue({
		projectId: "project-one",
		resourceId: "asset-water",
	});
	vi.spyOn(AssetNotesRoute, "useSearch").mockReturnValue({
		filter: "unused",
		query: "asset",
	});
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			editor: {
				onProjectChangedFn: () => () => undefined,
			},
		},
	});
	state.createFailures = 0;
	state.listFailures = 0;
	state.beforeCreateFn = undefined;
	state.nextNote = 2;
	state.notes = [];
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	document.body.replaceChildren();
	Reflect.deleteProperty(window, "arkini");
	vi.restoreAllMocks();
});

const renderNotes = async (global = false) => {
	const component = global
		? GlobalNotesRoute.options.component
		: AssetNotesRoute.options.component;
	if (component === undefined) throw new Error("Missing Notes route.");
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
					createElement(component),
				),
			),
		),
	);
	return container;
};

const clickFn = async (element: Element | undefined | null) => {
	if (!(element instanceof HTMLElement)) throw new Error("Expected clickable control.");
	await act(async () => element.click());
};

const setContentFn = async (container: HTMLElement, value: string) => {
	const textarea = container.querySelector("textarea");
	if (textarea === null) throw new Error("Expected composer.");
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
			textarea,
			value,
		);
		textarea.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

const selectLinkFn = async (container: HTMLElement, kind: "Asset" | "Item", title: string) => {
	await clickFn(container.querySelector(`[data-ui="EditorNote${kind}Links"] input`));
	await clickFn(
		[
			...document.querySelectorAll('[data-ui="EditorSearchComboboxOption"]'),
		].find((option) => option.textContent?.includes(title)),
	);
};

const createNoteFn = async (container: HTMLElement) =>
	clickFn(
		[
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Create note"),
	);

describe("asset Notes", () => {
	it("retains mixed links through failed filtered creation, preserves search, and removes only the current asset link", async () => {
		state.createFailures = 1;
		const container = await renderNotes();
		expect(
			container.querySelector<HTMLButtonElement>('[data-ui="EditorNoteUnlinkAsset"]')
				?.disabled,
		).toBe(true);
		await setContentFn(container, "Art direction");
		await selectLinkFn(container, "Asset", "asset-wood");
		await selectLinkFn(container, "Item", "Water");
		await createNoteFn(container);
		expect(state.notes).toHaveLength(0);
		expect(container.querySelector("textarea")?.value).toBe("Art direction");
		expect(container.querySelectorAll('[data-ui="EditorNoteAssetLinks"] a')).toHaveLength(2);
		await createNoteFn(container);
		const created = state.notes[0];
		expect(created).toMatchObject({
			itemUids: [
				"water",
			],
			resourceIds: [
				"asset-water",
				"asset-wood",
			],
			content: "Art direction",
		});
		expect(container.querySelectorAll('[data-ui="EditorNote"]')).toHaveLength(1);
		const preview = container.querySelector<HTMLAnchorElement>(
			'[data-ui="EditorNote"] [data-ui="EditorNoteAssetLinks"] a',
		);
		expect(preview?.getAttribute("href")).toBe(
			"/editor/project-one/assets/asset-water/detail/overview",
		);
		expect(JSON.parse(preview?.dataset.search ?? "null")).toEqual({
			filter: "unused",
			query: "asset",
		});
		await clickFn(
			container.querySelector('[data-ui="EditorNote"] [data-ui="EditorNoteUnlinkAsset"]'),
		);
		expect(container.querySelector('[data-ui="EditorNote"]')).toBeNull();
		expect(state.notes[0]).toMatchObject({
			noteId: created.noteId,
			createdAtMs: created.createdAtMs,
			content: created.content,
			itemUids: [
				"water",
			],
			resourceIds: [
				"asset-wood",
			],
		});
		expect(state.notes[0].updatedAtMs).toBeGreaterThan(created.updatedAtMs);
	});

	it("renders a mixed note once globally and preserves resource links when an item is removed", async () => {
		state.notes = [
			{
				noteId: "mixed",
				projectId: "project-one",
				content: "Mixed",
				itemUids: [
					"water",
				],
				resourceIds: [
					"asset-water",
					"asset-wood",
				],
				createdAtMs: 1,
				updatedAtMs: 1,
			},
		];
		const container = await renderNotes(true);
		expect(container.querySelectorAll('[data-ui="EditorNote"]')).toHaveLength(1);
		expect(
			container.querySelectorAll('[data-ui="EditorNote"] [data-ui="EditorNoteAssetLinks"] a'),
		).toHaveLength(2);
		const preview = container.querySelector<HTMLAnchorElement>(
			'[data-ui="EditorNote"] [data-ui="EditorNoteAssetLinks"] a',
		);
		expect(JSON.parse(preview?.dataset.search ?? "null")).toEqual({
			filter: "all",
			query: "asset-water",
		});
		await clickFn(
			container.querySelector('[data-ui="EditorNote"] [data-ui="EditorNoteUnlinkItem"]'),
		);
		expect(state.notes[0]).toMatchObject({
			itemUids: [],
			resourceIds: [
				"asset-water",
				"asset-wood",
			],
		});
	});

	it("keeps missing asset relationships visible and removable without a dangling navigation target", async () => {
		state.notes = [
			{
				noteId: "missing",
				projectId: "project-one",
				content: "Retained idea",
				itemUids: [],
				resourceIds: [
					"missing-asset",
				],
				createdAtMs: 1,
				updatedAtMs: 1,
			},
		];
		const container = await renderNotes(true);
		expect(
			container.querySelector('[data-ui="EditorNoteMissingAsset"]')?.textContent,
		).toContain("missing-asset");
		expect(
			container.querySelector('[data-ui="EditorNote"] [data-ui="EditorNoteAssetLinks"] a'),
		).toBeNull();
		await clickFn(
			container.querySelector('[data-ui="EditorNote"] [data-ui="EditorNoteUnlinkAsset"]'),
		);
		expect(state.notes[0]).toMatchObject({
			noteId: "missing",
			resourceIds: [],
			content: "Retained idea",
		});
	});
});

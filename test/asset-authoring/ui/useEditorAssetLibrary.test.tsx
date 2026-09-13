// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { NoteSchema } from "~/project-note/schema/NoteSchema";
import type { Project } from "~/project-authoring/type/Project";

const state = vi.hoisted(() => ({
	project: undefined as unknown,
	notes: [] as NoteSchema.Type[],
	loading: false,
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));
vi.mock("~/project-note/ui/useProjectNotes", () => ({
	useProjectNotes: () => ({
		notes: state.notes,
		loading: state.loading,
	}),
}));

import { useEditorAssetLibrary } from "~/asset-authoring/ui/useEditorAssetLibrary";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot> | undefined;
let library: ReturnType<typeof useEditorAssetLibrary> | undefined;

const Probe = ({ query }: { query: string }) => {
	library = useEditorAssetLibrary({
		filter: "with-note",
		query,
	});
	return null;
};
afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	document.body.replaceChildren();
});

it("filters by live resource note links rather than matching item links and preserves search", async () => {
	state.project = {
		projectId: "sample",
		revision: 1,
		config: editorTestConfig,
		resources: [
			"forge",
			"forge-overlay",
			"item-only",
		].map((id) => ({
			id,
			mime: "image/png",
			size: 0,
			version: "1",
		})),
	} satisfies Pick<Project, "projectId" | "revision" | "config" | "resources">;
	state.notes = [];
	state.loading = true;
	const container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () => root?.render(<Probe query="" />));
	expect(library?.notesLoading).toBe(true);
	state.notes = [
		{
			noteId: "note",
			projectId: "sample",
			content: "Refine the artwork",
			resourceIds: [
				"forge",
				"forge-overlay",
			],
			itemUids: [
				"item-only",
			],
			createdAtMs: 0,
			updatedAtMs: 0,
		},
	];
	state.loading = false;
	await act(async () => root?.render(<Probe query="" />));
	expect(library?.resources.map(({ id }) => id)).toEqual([
		"forge",
		"forge-overlay",
	]);
	expect(library?.notesLoading).toBe(false);
	await act(async () => root?.render(<Probe query="forge-overlay" />));
	expect(library?.resources[0]?.id).toBe("forge-overlay");
	state.notes = [
		{
			...state.notes[0]!,
			resourceIds: [
				"item-only",
			],
		},
	];
	await act(async () => root?.render(<Probe query="" />));
	expect(library?.resources.map(({ id }) => id)).toEqual([
		"item-only",
	]);
});

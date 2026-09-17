// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("~/project-note/atom/NoteCommandAtoms", async () => {
	const { EditorNotesTestCommandAtoms } = await import(
		"~test/project-note/support/EditorNotesFixture"
	);
	return {
		NoteCommandAtoms: EditorNotesTestCommandAtoms,
	};
});

import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { EditorProjectProvider } from "~/authoring-session/ui/useEditorProject";
import { EditorProjectReplacementBoundary } from "~/authoring-session/ui/EditorProjectReplacementBoundary";
import { refreshEditorProjectFx } from "~/authoring-session/fx/refreshEditorProjectFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import { createEditorUnsavedChangesOwnerFx } from "~/authoring-session/fx/createEditorUnsavedChangesOwnerFx";
import { createProjectWriteAdmissionFx } from "~/project-authoring/fx/createProjectWriteAdmissionFx";
import { useProjectNotes } from "~/project-note/ui/useProjectNotes";
import {
	editorNotesTestProject,
	editorNotesTestState,
} from "~test/project-note/support/EditorNotesFixture";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("rereads retained Notes after hard Refresh without an authoring revision change", async () => {
	const project = {
		...editorNotesTestProject,
		title: editorNotesTestProject.config.meta.title,
	};
	editorNotesTestState.listFailures = 0;
	editorNotesTestState.notes = [
		{
			noteId: "note-one",
			projectId: project.projectId,
			content: "Original note",
			itemUids: [],
			resourceIds: [],
			createdAtMs: 1,
			updatedAtMs: 1,
		},
	];
	vi.stubGlobal("arkini", {
		editor: {
			onProjectChangedFn: () => () => undefined,
			refreshProjectFn: async () => ({
				type: "success",
				value: project,
			}),
		},
		editorMcp: {
			setProjectContextFn: async () => undefined,
			clearProjectContextFn: async () => undefined,
		},
	});
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	const NotesProjection = () => {
		const collection = useProjectNotes(project.projectId);
		return <output>{collection.notes.map((note) => note.content).join(",")}</output>;
	};
	try {
		await act(async () =>
			root.render(
				<RegistryContext.Provider value={registry}>
					<EditorProjectProvider loaded={project}>
						<EditorProjectReplacementBoundary>
							<NotesProjection />
						</EditorProjectReplacementBoundary>
					</EditorProjectProvider>
				</RegistryContext.Provider>,
			),
		);
		await vi.waitFor(() => expect(host.textContent).toBe("Original note"));
		editorNotesTestState.notes = [
			{
				...editorNotesTestState.notes[0],
				content: "Externally updated note",
				updatedAtMs: 2,
			},
		];
		await act(async () => {
			await Effect.runPromise(
				refreshEditorProjectFx({
					projectId: project.projectId,
					isNavigationPendingFn: () => false,
				}).pipe(
					Effect.provideService(AtomRegistry.AtomRegistry, registry),
					Effect.provideService(ProjectRepository, {
						...UnusedEditorProjectRepository,
						awaitIdleFx: Effect.void,
						createProjectFx: () => Effect.die("Unexpected project creation."),
						deleteItemFx: () => Effect.die("Unexpected item deletion."),
						listProjectsFx: Effect.die("Unexpected project listing."),
						readProjectFx: () => Effect.die("Unexpected project read."),
						replaceConfigFx: () => Effect.die("Unexpected config replacement."),
						replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
						upsertItemFx: () => Effect.die("Unexpected item write."),
					}),
					Effect.provideService(
						ProjectWriteAdmission,
						Effect.runSync(createProjectWriteAdmissionFx),
					),
					Effect.provideService(
						EditorUnsavedChanges,
						Effect.runSync(createEditorUnsavedChangesOwnerFx()),
					),
				),
			);
		});
		expect(registry.get(EditorProjectAtom(project.projectId))?.revision).toBe(project.revision);
		await vi.waitFor(() => expect(host.textContent).toBe("Externally updated note"));
	} finally {
		await act(async () => root.unmount());
		registry.dispose();
		host.remove();
		vi.unstubAllGlobals();
	}
});

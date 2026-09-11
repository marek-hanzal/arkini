import { parseVersionFn } from "~/game-version/fn/parseVersionFn";
import { Effect } from "effect";
import { vi } from "vitest";

import { formatVersionFn } from "~/game-version/fn/formatVersionFn";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

export const editorProjectIpcDescriptor = {
	projectId: "project-one",
	title: editorTestPayload.config.meta.title,
	version: parseVersionFn(editorTestPayload.version),
	createdAtMs: 1,
	updatedAtMs: 2,
};

export const editorProjectIpcCommit = {
	...editorProjectIpcDescriptor,
	previousRevision: 0,
	revision: 1,
	config: editorTestPayload.config,
};

export const editorProjectIpcProject = {
	...editorProjectIpcDescriptor,
	revision: editorProjectIpcCommit.revision,
	config: editorProjectIpcCommit.config,
	resources: editorTestPayload.resources,
};

export const editorProjectIpcBuild = {
	version: formatVersionFn(editorProjectIpcProject.version),
	projectId: editorProjectIpcProject.projectId,
	revision: editorProjectIpcProject.revision,
	contentHash: "a".repeat(64),
	size: 3,
	diagnostics: [],
};

export const editorProjectIpcNote = {
	noteId: "note-one",
	projectId: editorProjectIpcProject.projectId,
	content: "A project note",
	itemUids: [],
	resourceIds: [],
	createdAtMs: 4,
	updatedAtMs: 4,
};

/** Creates one explicit repository spy for the editor-project IPC boundary. */
export const createEditorProjectIpcRepository = (): OwnedEditorProjectRepository => ({
	awaitIdleFx: Effect.void,
	saveBuildVersionFx: vi.fn(({ version }) => Effect.succeed(version)),
	buildProjectFx: vi.fn(() => Effect.succeed(editorProjectIpcBuild)),
	createProjectFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	deleteProjectFx: vi.fn(() => Effect.void),
	createNoteFx: vi.fn(({ projectId, content, itemUids, resourceIds }) =>
		Effect.succeed({
			...editorProjectIpcNote,
			projectId,
			content,
			itemUids: [
				...itemUids,
			],
			resourceIds: [
				...resourceIds,
			],
		}),
	),
	deleteNoteFx: vi.fn(() => Effect.void),
	deleteItemFx: vi.fn(() => Effect.succeed(editorProjectIpcCommit)),
	deleteResourceFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	optimizeResourcesFx: vi.fn(({ onProgressFn }) =>
		Effect.sync(() =>
			onProgressFn?.({
				completedResourceCount: 1,
				phase: "optimizing",
				totalResourceCount: 2,
			}),
		).pipe(
			Effect.as({
				optimizedResourceCount: 0,
				originalBytes: 0,
				optimizedBytes: 0,
				processedResourceCount: 2,
				project: editorProjectIpcProject,
			}),
		),
	),
	listProjectsFx: Effect.succeed([
		{
			type: "valid" as const,
			ownership: "managed" as const,
			project: editorProjectIpcDescriptor,
		},
	]),
	listNotesFx: vi.fn(() =>
		Effect.succeed([
			editorProjectIpcNote,
		]),
	),
	openProjectFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	readProjectFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	readProjectBuildFx: vi.fn(() =>
		Effect.succeed({
			bytes: new Uint8Array([
				1,
				2,
				3,
			]),
		}),
	),
	readProjectRootFx: vi.fn(() => Effect.succeed("/editor/project-one")),
	refreshProjectFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	replaceConfigFx: vi.fn(() => Effect.succeed(editorProjectIpcCommit)),
	replaceResourceFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	upsertItemFx: vi.fn(() => Effect.succeed(editorProjectIpcCommit)),
	upsertResourcesFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	updateNoteFx: vi.fn(({ projectId, noteId, content, itemUids, resourceIds }) =>
		Effect.succeed({
			...editorProjectIpcNote,
			projectId,
			noteId,
			content,
			itemUids: [
				...itemUids,
			],
			resourceIds: [
				...resourceIds,
			],
			updatedAtMs: 5,
		}),
	),
	closeFx: Effect.void,
});

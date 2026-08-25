import { Effect } from "effect";
import { vi } from "vitest";

import type { SqliteEditorProjectRepository } from "../../../../../electron/main/editor-project/sqlite/fx/createSqliteEditorProjectRepositoryFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

export const editorProjectIpcDescriptor = {
	projectId: "project-one",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: 2,
};

export const editorProjectIpcCommit = {
	...editorProjectIpcDescriptor,
	revision: 1,
	config: editorTestPayload.config,
};

export const editorProjectIpcProject = {
	...editorProjectIpcCommit,
	resources: editorTestPayload.resources,
};

/** Creates one explicit repository spy for the editor-project IPC boundary. */
export const createEditorProjectIpcRepository = (): SqliteEditorProjectRepository => ({
	awaitIdleFx: Effect.void,
	createProjectFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	deleteProjectFx: vi.fn(() => Effect.void),
	listProjectsFx: Effect.succeed([
		editorProjectIpcDescriptor,
	]),
	readProjectFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	replaceConfigFx: vi.fn(() => Effect.succeed(editorProjectIpcCommit)),
	replaceResourceFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	upsertItemFx: vi.fn(() => Effect.succeed(editorProjectIpcCommit)),
	upsertResourcesFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	listBoardScenariosFx: vi.fn(() => Effect.succeed([])),
	readBoardScenarioFx: vi.fn(() => Effect.succeed(null)),
	writeBoardScenarioFx: vi.fn(({ projectId, name, bytes }) =>
		Effect.succeed({
			projectId,
			name,
			projectRevision: editorProjectIpcProject.revision,
			version: editorProjectIpcProject.version,
			bytes,
			createdAtMs: 3,
			updatedAtMs: 3,
		}),
	),
	deleteBoardScenarioFx: vi.fn(() => Effect.void),
	closeFx: Effect.void,
});

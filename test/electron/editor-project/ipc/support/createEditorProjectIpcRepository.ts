import { Effect } from "effect";
import { vi } from "vitest";

import { ArkiniAppVersion } from "../../../../../shared/ArkiniAppMetadata";
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

export const editorProjectIpcVersion = {
	applicability: {
		type: "applicable" as const,
	},
	arkini: ArkiniAppVersion,
	arkpackVersion: editorProjectIpcProject.version,
	createdAtMs: 3,
	projectId: editorProjectIpcProject.projectId,
	snapshotFormatVersion: 1,
	sourceRevision: editorProjectIpcProject.revision,
	subject: "Initial version",
	versionId: "version-one",
};

/** Creates one explicit repository spy for the editor-project IPC boundary. */
export const createEditorProjectIpcRepository = (): SqliteEditorProjectRepository => ({
	awaitIdleFx: Effect.void,
	createProjectFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	createVersionFx: vi.fn(() => Effect.succeed(editorProjectIpcVersion)),
	checkoutVersionFx: vi.fn(() => Effect.void),
	deleteProjectFx: vi.fn(() => Effect.void),
	deleteItemFx: vi.fn(() => Effect.succeed(editorProjectIpcCommit)),
	deleteResourceFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	diffVersionsFx: vi.fn(({ from, to }) =>
		Effect.succeed({
			from,
			to,
			hasChanges: false,
			project: [],
			items: [],
			resources: [],
			scenarios: [],
		}),
	),
	listProjectsFx: Effect.succeed([
		editorProjectIpcDescriptor,
	]),
	listVersionsFx: vi.fn(() =>
		Effect.succeed([
			editorProjectIpcVersion,
		]),
	),
	readProjectFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	readVersionStatusFx: vi.fn(() =>
		Effect.succeed({
			canCommit: true,
			currentFingerprint: "fingerprint",
			dirty: true,
			versionCount: 0,
		}),
	),
	replaceConfigFx: vi.fn(() => Effect.succeed(editorProjectIpcCommit)),
	replaceResourceFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	saveResourceFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	upsertItemFx: vi.fn(() => Effect.succeed(editorProjectIpcCommit)),
	upsertResourcesFx: vi.fn(() => Effect.succeed(editorProjectIpcProject)),
	updateVersionTagFx: vi.fn(() => Effect.succeed(editorProjectIpcVersion)),
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

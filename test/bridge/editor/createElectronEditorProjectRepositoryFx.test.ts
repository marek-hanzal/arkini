// @vitest-environment jsdom

import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import { createElectronEditorProjectRepositoryFx } from "~/bridge/editor/createElectronEditorProjectRepositoryFx";
import { blockEditorProjectWrites } from "~/bridge/editor/EditorProjectWriteAdmission";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const success = <Value>(value: Value): EditorProjectTransport.Result<Value> => ({
	type: "success",
	value,
});

const descriptor: EditorProjectTransport.Descriptor = {
	projectId: "project-one",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 10,
	updatedAtMs: 11,
};

const commit: EditorProjectTransport.Commit = {
	...descriptor,
	previousRevision: 1,
	revision: 2,
	config: editorTestPayload.config,
};

const project: EditorProjectTransport.Project = {
	...descriptor,
	revision: commit.revision,
	config: commit.config,
	resources: editorTestPayload.resources.map((resource) => ({
		...resource,
		bytes: new Uint8Array(resource.bytes),
	})),
};

const version: EditorProjectTransport.VersionDescriptor = {
	arkini: "0.5.0",
	arkpackVersion: "1.0",
	createdAtMs: 12,
	projectId: "project-one",
	sourceRevision: 2,
	subject: "Initial state",
	versionId: "version-one",
};

const installEditorApi = () => {
	const editor: Window["arkini"]["editor"] = {
		status: vi.fn(async () => ({
			type: "ready" as const,
		})),
		awaitIdle: vi.fn(async () => success(undefined)),
		createProject: vi.fn(async () => success(project)),
		createNote: vi.fn(async ({ projectId, content }) =>
			success({
				noteId: "note-one",
				projectId,
				content,
				createdAtMs: 12,
				updatedAtMs: 12,
			}),
		),
		deleteProject: vi.fn(async () => success(undefined)),
		deleteNote: vi.fn(async () => success(undefined)),
		deleteItem: vi.fn(async () => success(commit)),
		deleteResource: vi.fn(async () => success(project)),
		exportJsonDirectory: vi.fn(async () => success(null)),
		importJsonDirectory: vi.fn(async () => success(descriptor)),
		listProjects: vi.fn(async () =>
			success([
				descriptor,
			]),
		),
		listNotes: vi.fn(async () => success([])),
		openExportDirectory: vi.fn(async () => success(undefined)),
		readProject: vi.fn(async () => success(project)),
		refreshProject: vi.fn(async () => success(project)),
		onProjectChanged: vi.fn(() => () => undefined),
		replaceConfig: vi.fn(async () => success(commit)),
		replaceResource: vi.fn(async () => success(project)),
		saveResource: vi.fn(async () => success(project)),
		upsertItem: vi.fn(async () => success(commit)),
		upsertResources: vi.fn(async () => success(project)),
		listBoardScenarios: vi.fn(async () => success([])),
		readBoardScenario: vi.fn(async () => success(null)),
		writeBoardScenario: vi.fn(async () =>
			success({
				projectId: "project-one",
				name: "Scenario 1",
				projectRevision: 2,
				version: editorTestPayload.version,
				bytes: new Uint8Array([
					1,
				]),
				createdAtMs: 12,
				updatedAtMs: 12,
			}),
		),
		deleteBoardScenario: vi.fn(async () => success(undefined)),
		readVersionStatus: vi.fn(async () =>
			success({
				canCommit: false,
				currentBaseVersionId: version.versionId,
				currentFingerprint: "a".repeat(64),
				dirty: false,
				versionCount: 1,
			}),
		),
		listVersions: vi.fn(async () =>
			success([
				version,
			]),
		),
		diffVersions: vi.fn(async (request) =>
			success({
				from: request.from,
				to: request.to,
				hasChanges: false,
				project: [],
				items: [],
				resources: [],
				scenarios: [],
			}),
		),
		createVersion: vi.fn(async () => success(version)),
		checkoutVersion: vi.fn(async () => success(undefined)),
		updateVersionTag: vi.fn(async () => success(version)),
		updateNote: vi.fn(async ({ projectId, noteId, content }) =>
			success({
				noteId,
				projectId,
				content,
				createdAtMs: 12,
				updatedAtMs: 13,
			}),
		),
	};
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			editor,
		},
	});
	return editor;
};

const readTypedFailure = async <Value>(
	effect: Effect.Effect<Value, EditorProjectRepositoryError>,
) => {
	const exit = await Effect.runPromiseExit(effect);
	expect(Exit.isFailure(exit)).toBe(true);
	if (Exit.isSuccess(exit)) throw new Error("Expected editor repository failure.");
	expect(Cause.hasDies(exit.cause)).toBe(false);
	const failure = Cause.findErrorOption(exit.cause);
	expect(Option.isSome(failure)).toBe(true);
	if (Option.isNone(failure)) throw new Error("Expected typed editor repository failure.");
	expect(failure.value).toBeInstanceOf(EditorProjectRepositoryError);
	return failure.value as EditorProjectRepositoryError;
};

afterEach(() => {
	Reflect.deleteProperty(window, "arkini");
});

describe("createElectronEditorProjectRepositoryFx", () => {
	it("preserves a stable server failure envelope as one typed repository failure", async () => {
		const editor = installEditorApi();
		vi.mocked(editor.listProjects).mockResolvedValueOnce({
			type: "failure",
			error: {
				operation: "list-projects",
				message: "The editor service is unavailable.",
			},
		});
		const repository = Effect.runSync(createElectronEditorProjectRepositoryFx);

		const failure = await readTypedFailure(repository.listProjectsFx);

		expect(failure).toEqual(
			new EditorProjectRepositoryError({
				operation: "list-projects",
				message: "The editor service is unavailable.",
			}),
		);
	});

	it("preserves a main-process invalid request as a typed repository failure", async () => {
		const editor = installEditorApi();
		vi.mocked(editor.readProject).mockResolvedValueOnce({
			type: "failure",
			error: {
				operation: "read-project",
				message: "The editor project request is invalid.",
			},
		});
		const repository = Effect.runSync(createElectronEditorProjectRepositoryFx);

		const failure = await readTypedFailure(repository.readProjectFx(""));

		expect(failure.operation).toBe("read-project");
		expect(failure.message).toBe("The editor project request is invalid.");
		expect(editor.readProject).toHaveBeenCalledWith("");
	});

	it("rejects invalid project and version responses at the renderer boundary", async () => {
		const editor = installEditorApi();
		vi.mocked(editor.readProject).mockResolvedValueOnce(
			success({
				...project,
				title: "Metadata drift",
			}),
		);
		vi.mocked(editor.listVersions).mockResolvedValueOnce(
			success([
				{
					...version,
					sourceRevision: -1,
				},
			]),
		);
		const repository = Effect.runSync(createElectronEditorProjectRepositoryFx);

		const projectFailure = await readTypedFailure(repository.readProjectFx("project-one"));
		const versionFailure = await readTypedFailure(repository.listVersionsFx("project-one"));

		expect(projectFailure.message).toBe("The editor IPC response is invalid.");
		expect(versionFailure).toMatchObject({
			operation: "list-versions",
			message: "The editor IPC response is invalid.",
		});
	});

	it("rejects note responses that escape the requested project or note identity", async () => {
		const editor = installEditorApi();
		vi.mocked(editor.listNotes).mockResolvedValueOnce(
			success([
				{
					noteId: "foreign-note",
					projectId: "another-project",
					content: "Foreign",
					createdAtMs: 1,
					updatedAtMs: 1,
				},
			]),
		);
		vi.mocked(editor.updateNote).mockResolvedValueOnce(
			success({
				noteId: "another-note",
				projectId: "project-one",
				content: "Wrong identity",
				createdAtMs: 1,
				updatedAtMs: 2,
			}),
		);
		const repository = Effect.runSync(createElectronEditorProjectRepositoryFx);

		const listFailure = await readTypedFailure(repository.listNotesFx("project-one"));
		const updateFailure = await readTypedFailure(
			repository.updateNoteFx({
				projectId: "project-one",
				noteId: "note-one",
				content: "Updated",
			}),
		);

		expect(listFailure).toMatchObject({
			operation: "list-notes",
			message: "The editor IPC response is invalid.",
		});
		expect(updateFailure).toMatchObject({
			operation: "update-note",
			message: "The editor IPC response is invalid.",
		});
	});

	it("keeps resource bytes typed across request and response boundaries", async () => {
		const editor = installEditorApi();
		const repository = Effect.runSync(createElectronEditorProjectRepositoryFx);
		const requestBytes = new Uint8Array([
			9,
			8,
			7,
		]);

		const saved = await Effect.runPromise(
			repository.upsertResourcesFx({
				projectId: "project-one",
				resources: [
					{
						id: "fresh-resource",
						mime: "image/png",
						bytes: requestBytes,
					},
				],
			}),
		);

		const request = vi.mocked(editor.upsertResources).mock.calls[0]?.[0];
		expect(request?.resources[0]).toMatchObject({
			id: "fresh-resource",
			mime: "image/png",
			bytes: expect.any(Uint8Array),
		});
		expect(saved.resources[0]?.bytes).toBeInstanceOf(Uint8Array);
		expect(saved.resources[0]?.bytes).not.toBe(project.resources[0]?.bytes);
	});

	it("blocks save-resource IPC while a hard project replacement owns writes", async () => {
		const editor = installEditorApi();
		const repository = Effect.runSync(createElectronEditorProjectRepositoryFx);
		const release = blockEditorProjectWrites();
		try {
			const failure = await readTypedFailure(
				repository.saveResourceFx({
					projectId: "project-one",
					expectedRevision: project.revision,
					overwrite: false,
					resource: editorTestPayload.resources[0]!,
				}),
			);
			expect(failure.operation).toBe("save-resource");
			expect(editor.saveResource).not.toHaveBeenCalled();
		} finally {
			release();
		}
	});
});

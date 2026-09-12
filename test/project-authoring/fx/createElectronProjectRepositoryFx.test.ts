import { parseVersionFn } from "~/game-version/fn/parseVersionFn";
// @vitest-environment jsdom

import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProjectTransport } from "~electron/contract/editor/EditorProjectTransport";
import { createElectronProjectRepositoryFx } from "~/project-authoring/fx/createElectronProjectRepositoryFx";
import { createProjectWriteAdmissionFx } from "~/project-authoring/fx/createProjectWriteAdmissionFx";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import {
	editorTestResources,
	editorTestPayload,
} from "~test/project-authoring/support/editorTestPayload";

const success = <Value>(value: Value): EditorProjectTransport.Result<Value> => ({
	type: "success",
	value,
});

const descriptor: EditorProjectTransport.Descriptor = {
	projectId: "project-one",
	title: editorTestPayload.config.meta.title,
	version: parseVersionFn(editorTestPayload.version),
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
	resources: editorTestResources,
};

const installEditorApi = () => {
	const editor: Window["arkini"]["editor"] = {
		saveBuildVersionFn: vi.fn(async ({ version }) => success(version)),
		buildProjectFn: vi.fn(async () => {
			throw new Error("Unexpected build.");
		}),
		readProjectBuildFn: vi.fn(async () => {
			throw new Error("Unexpected build read.");
		}),
		saveProjectBuildFn: vi.fn(async () => {
			throw new Error("Unexpected build save.");
		}),
		statusFn: vi.fn(async () => ({
			type: "ready" as const,
		})),
		awaitIdleFn: vi.fn(async () => success(undefined)),
		createProjectFn: vi.fn(async () => success(project)),
		createNoteFn: vi.fn(async ({ projectId, content, itemUids, resourceIds }) =>
			success({
				noteId: "note-one",
				projectId,
				content,
				itemUids,
				resourceIds,
				createdAtMs: 12,
				updatedAtMs: 12,
			}),
		),
		deleteProjectFn: vi.fn(async () => success(undefined)),
		deleteNoteFn: vi.fn(async () => success(undefined)),
		deleteItemFn: vi.fn(async () => success(commit)),
		deleteResourceFn: vi.fn(async () => success(project)),
		optimizeResourcesFn: vi.fn(async () =>
			success({
				optimizedResourceCount: 0,
				originalBytes: 0,
				optimizedBytes: 0,
				processedResourceCount: 1,
				project,
			}),
		),
		exportJsonDirectoryFn: vi.fn(async () => success(null)),
		importJsonDirectoryFn: vi.fn(async () => success(descriptor)),
		listProjectsFn: vi.fn(async () =>
			success([
				{
					type: "valid" as const,
					ownership: "external" as const,
					project: descriptor,
				},
			]),
		),
		listNotesFn: vi.fn(async () => success([])),
		dismissInvalidProjectFn: vi.fn(async () => success(undefined)),
		openProjectDirectoryFn: vi.fn(async () => success(undefined)),
		readProjectFn: vi.fn(async () => success(project)),
		refreshProjectFn: vi.fn(async () => success(project)),
		onProjectChangedFn: vi.fn(() => () => undefined),
		onOptimizeResourcesProgressFn: vi.fn(() => () => undefined),
		replaceConfigFn: vi.fn(async () => success(commit)),
		replaceResourceFn: vi.fn(async () => success(project)),
		upsertItemFn: vi.fn(async () => success(commit)),
		upsertResourcesFn: vi.fn(async () => success(project)),
		updateNoteFn: vi.fn(async ({ projectId, noteId, content, itemUids, resourceIds }) =>
			success({
				noteId,
				projectId,
				content,
				itemUids,
				resourceIds,
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

const readTypedFailure = async <Value>(effect: Effect.Effect<Value, ProjectRepositoryError>) => {
	const exit = await Effect.runPromiseExit(effect);
	expect(Exit.isFailure(exit)).toBe(true);
	if (Exit.isSuccess(exit)) throw new Error("Expected editor repository failure.");
	expect(Cause.hasDies(exit.cause)).toBe(false);
	const failure = Cause.findErrorOption(exit.cause);
	expect(Option.isSome(failure)).toBe(true);
	if (Option.isNone(failure)) throw new Error("Expected typed editor repository failure.");
	expect(failure.value).toBeInstanceOf(ProjectRepositoryError);
	return failure.value as ProjectRepositoryError;
};

const createRepository = () => {
	const admission = Effect.runSync(createProjectWriteAdmissionFx);
	return {
		admission,
		repository: Effect.runSync(
			createElectronProjectRepositoryFx.pipe(
				Effect.provideService(ProjectWriteAdmission, admission),
			),
		),
	};
};

afterEach(() => {
	Reflect.deleteProperty(window, "arkini");
});

describe("createElectronProjectRepositoryFx", () => {
	it("preserves a stable server failure envelope as one typed repository failure", async () => {
		const editor = installEditorApi();
		vi.mocked(editor.listProjectsFn).mockResolvedValueOnce({
			type: "failure",
			error: {
				operation: "list-projects",
				message: "The editor service is unavailable.",
			},
		});
		const { repository } = createRepository();

		const failure = await readTypedFailure(repository.listProjectsFx);

		expect(failure).toEqual(
			new ProjectRepositoryError({
				operation: "list-projects",
				message: "The editor service is unavailable.",
			}),
		);
	});

	it("rejects malformed result envelopes as typed boundary failures", async () => {
		const editor = installEditorApi();
		vi.mocked(editor.listProjectsFn).mockResolvedValueOnce({
			type: "invalid-envelope",
		} as never);
		const { repository } = createRepository();

		const envelopeFailure = await readTypedFailure(repository.listProjectsFx);

		expect(envelopeFailure).toMatchObject({
			operation: "list-projects",
			message: "The editor IPC response is invalid.",
		});
	});

	it("preserves a main-process invalid request as a typed repository failure", async () => {
		const editor = installEditorApi();
		vi.mocked(editor.readProjectFn).mockResolvedValueOnce({
			type: "failure",
			error: {
				operation: "read-project",
				message: "The editor project request is invalid.",
			},
		});
		const { repository } = createRepository();

		const failure = await readTypedFailure(repository.readProjectFx(""));

		expect(failure.operation).toBe("read-project");
		expect(failure.message).toBe("The editor project request is invalid.");
		expect(editor.readProjectFn).toHaveBeenCalledWith("");
	});

	it("rejects invalid project responses at the renderer boundary", async () => {
		const editor = installEditorApi();
		vi.mocked(editor.readProjectFn).mockResolvedValueOnce(
			success({
				...project,
				title: "Metadata drift",
			}),
		);
		const { repository } = createRepository();

		const projectFailure = await readTypedFailure(repository.readProjectFx("project-one"));

		expect(projectFailure.message).toBe("The editor IPC response is invalid.");
	});

	it("rejects note responses that escape the requested project or note identity", async () => {
		const editor = installEditorApi();
		vi.mocked(editor.listNotesFn).mockResolvedValueOnce(
			success([
				{
					noteId: "foreign-note",
					projectId: "another-project",
					content: "Foreign",
					itemUids: [],
					resourceIds: [],
					createdAtMs: 1,
					updatedAtMs: 1,
				},
			]),
		);
		vi.mocked(editor.updateNoteFn).mockResolvedValueOnce(
			success({
				noteId: "another-note",
				projectId: "project-one",
				content: "Wrong identity",
				itemUids: [],
				resourceIds: [],
				createdAtMs: 1,
				updatedAtMs: 2,
			}),
		);
		const { repository } = createRepository();

		const listFailure = await readTypedFailure(repository.listNotesFx("project-one"));
		const updateFailure = await readTypedFailure(
			repository.updateNoteFx({
				itemUids: [],
				resourceIds: [],
				projectId: "project-one",
				noteId: "note-one",
				expectedUpdatedAtMs: 1,
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

	it("sends uploaded bytes but receives only asset metadata", async () => {
		const editor = installEditorApi();
		const { repository } = createRepository();
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
		const optimized = await Effect.runPromise(
			repository.optimizeResourcesFx({
				expectedRevision: project.revision,
				projectId: project.projectId,
				resourceIds: [
					"hero",
				],
			}),
		);

		const request = vi.mocked(editor.upsertResourcesFn).mock.calls[0]?.[0];
		expect(request?.resources[0]).toMatchObject({
			id: "fresh-resource",
			mime: "image/png",
			bytes: expect.any(Uint8Array),
		});
		expect(saved.resources).toEqual(editorTestResources);
		expect(saved.resources[0]).not.toHaveProperty("bytes");
		expect(editor.optimizeResourcesFn).toHaveBeenCalledWith({
			expectedRevision: project.revision,
			projectId: project.projectId,
			resourceIds: [
				"hero",
			],
		});
		expect(optimized.project.resources).toEqual(editorTestResources);
		expect(optimized.project.resources[0]).not.toHaveProperty("bytes");
	});

	it("forwards matching resource optimization progress and releases the listener", async () => {
		const editor = installEditorApi();
		const { repository } = createRepository();
		const onProgressFn = vi.fn();
		const unsubscribeFn = vi.fn();
		let reportProgressFn:
			| Parameters<Window["arkini"]["editor"]["onOptimizeResourcesProgressFn"]>[0]
			| undefined;
		vi.mocked(editor.onOptimizeResourcesProgressFn).mockImplementation((listenerFn) => {
			reportProgressFn = listenerFn;
			return unsubscribeFn;
		});
		vi.mocked(editor.optimizeResourcesFn).mockImplementation(async (request) => {
			reportProgressFn?.({
				completedResourceCount: 1,
				expectedRevision: request.expectedRevision,
				phase: "optimizing",
				projectId: request.projectId,
				totalResourceCount: 2,
			});
			reportProgressFn?.({
				completedResourceCount: 9,
				expectedRevision: request.expectedRevision,
				phase: "optimizing",
				projectId: "another-project",
				totalResourceCount: 9,
			});
			return success({
				optimizedResourceCount: 0,
				originalBytes: 0,
				optimizedBytes: 0,
				processedResourceCount: 2,
				project,
			});
		});

		await Effect.runPromise(
			repository.optimizeResourcesFx({
				expectedRevision: project.revision,
				onProgressFn,
				projectId: project.projectId,
				resourceIds: [
					"hero",
					"item-water",
				],
			}),
		);

		expect(onProgressFn).toHaveBeenCalledExactlyOnceWith({
			completedResourceCount: 1,
			phase: "optimizing",
			totalResourceCount: 2,
		});
		expect(unsubscribeFn).toHaveBeenCalledOnce();
	});

	it("blocks resource import IPC while a hard project replacement owns writes", async () => {
		const editor = installEditorApi();
		const { admission, repository } = createRepository();
		const releaseFx = Effect.runSync(
			admission.acquireReplacementFx("refresh-project", () => false),
		);
		try {
			const failure = await readTypedFailure(
				repository.upsertResourcesFx({
					projectId: "project-one",
					resources: [
						editorTestPayload.resources[0]!,
					],
				}),
			);
			expect(failure.operation).toBe("upsert-resource");
			expect(editor.upsertResourcesFn).not.toHaveBeenCalled();
		} finally {
			Effect.runSync(releaseFx);
		}
	});
});

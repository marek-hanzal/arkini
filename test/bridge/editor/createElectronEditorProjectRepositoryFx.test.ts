// @vitest-environment jsdom

import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import { createElectronEditorProjectRepositoryFx } from "~/bridge/editor/createElectronEditorProjectRepositoryFx";
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
	revision: 2,
	config: editorTestPayload.config,
};

const createProjectTransport = (): EditorProjectTransport.Project => ({
	...commit,
	resources: [
		{
			...editorTestPayload.resources[1],
			bytes: new Uint8Array(editorTestPayload.resources[1].bytes),
		},
		{
			...editorTestPayload.resources[0],
			bytes: new Uint8Array(editorTestPayload.resources[0].bytes),
		},
	],
});

const installEditorApi = () => {
	const project = createProjectTransport();
	const editor: Window["arkini"]["editor"] = {
		status: vi.fn(async () => ({
			type: "ready" as const,
		})),
		awaitIdle: vi.fn(async () => success(undefined)),
		createProject: vi.fn(async () => success(project)),
		listProjects: vi.fn(async () =>
			success([
				descriptor,
			]),
		),
		readProject: vi.fn(async () => success(project)),
		replaceConfig: vi.fn(async () => success(commit)),
		replaceResource: vi.fn(async () => success(project)),
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
	};
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			editor,
		},
	});
	return {
		editor,
		project,
	};
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
	it("maps every repository operation through the narrow Electron editor API", async () => {
		const { editor, project: transportedProject } = installEditorApi();
		const repository = Effect.runSync(createElectronEditorProjectRepositoryFx);
		const createRequest = {
			projectId: "project-one",
			version: "1.0",
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		};
		const replacementResource = {
			...editorTestPayload.resources[0],
			id: "hero-next",
		};

		await expect(Effect.runPromise(repository.awaitIdleFx)).resolves.toBeUndefined();
		const created = await Effect.runPromise(repository.createProjectFx(createRequest));
		const listed = await Effect.runPromise(repository.listProjectsFx);
		const read = await Effect.runPromise(repository.readProjectFx("project-one"));
		const replacedConfig = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: "project-one",
				expectedRevision: 1,
				config: editorTestPayload.config,
			}),
		);
		const replacedResource = await Effect.runPromise(
			repository.replaceResourceFx({
				projectId: "project-one",
				currentId: "hero",
				expectedRevision: 1,
				config: editorTestPayload.config,
				resource: replacementResource,
			}),
		);
		const upsertedItem = await Effect.runPromise(
			repository.upsertItemFx({
				projectId: "project-one",
				item: editorTestPayload.config.items.water,
			}),
		);
		const upsertedResources = await Effect.runPromise(
			repository.upsertResourcesFx({
				projectId: "project-one",
				resources: [
					replacementResource,
				],
			}),
		);
		const listedScenarios = await Effect.runPromise(
			repository.listBoardScenariosFx("project-one"),
		);
		const readScenario = await Effect.runPromise(
			repository.readBoardScenarioFx({
				projectId: "project-one",
				name: "Scenario 1",
			}),
		);
		const writtenScenario = await Effect.runPromise(
			repository.writeBoardScenarioFx({
				projectId: "project-one",
				expectedRevision: 2,
				name: "Scenario 1",
				bytes: new Uint8Array([
					1,
				]),
			}),
		);
		await Effect.runPromise(
			repository.deleteBoardScenarioFx({
				projectId: "project-one",
				name: "Scenario 1",
			}),
		);

		expect(editor.awaitIdle).toHaveBeenCalledOnce();
		expect(editor.createProject).toHaveBeenCalledWith(createRequest);
		expect(editor.listProjects).toHaveBeenCalledOnce();
		expect(editor.readProject).toHaveBeenCalledWith("project-one");
		expect(editor.replaceConfig).toHaveBeenCalledWith({
			projectId: "project-one",
			expectedRevision: 1,
			config: editorTestPayload.config,
		});
		expect(editor.replaceResource).toHaveBeenCalledWith({
			projectId: "project-one",
			currentId: "hero",
			expectedRevision: 1,
			config: editorTestPayload.config,
			resource: replacementResource,
		});
		expect(editor.upsertItem).toHaveBeenCalledWith({
			projectId: "project-one",
			item: editorTestPayload.config.items.water,
		});
		expect(editor.upsertResources).toHaveBeenCalledWith({
			projectId: "project-one",
			resources: [
				replacementResource,
			],
		});
		expect(editor.listBoardScenarios).toHaveBeenCalledWith("project-one");
		expect(editor.readBoardScenario).toHaveBeenCalledWith({
			projectId: "project-one",
			name: "Scenario 1",
		});
		expect(editor.writeBoardScenario).toHaveBeenCalledWith({
			projectId: "project-one",
			expectedRevision: 2,
			name: "Scenario 1",
			bytes: new Uint8Array([
				1,
			]),
		});
		expect(editor.deleteBoardScenario).toHaveBeenCalledWith({
			projectId: "project-one",
			name: "Scenario 1",
		});
		expect(listedScenarios).toEqual([]);
		expect(readScenario).toBeNull();
		expect(writtenScenario.bytes).toEqual(
			new Uint8Array([
				1,
			]),
		);
		expect(listed).toEqual([
			descriptor,
		]);
		expect(replacedConfig).toEqual(commit);
		expect(upsertedItem).toEqual(commit);
		expect(created).toEqual(read);
		expect(created).toEqual(replacedResource);
		expect(created).toEqual(upsertedResources);
		expect(created.resources.map(({ id }) => id)).toEqual([
			"hero",
			"item-water",
		]);
		for (const resource of created.resources) {
			expect(resource.bytes).toBeInstanceOf(Uint8Array);
			const transported = transportedProject.resources.find(({ id }) => id === resource.id);
			expect(transported).toBeDefined();
			expect(resource.bytes).toEqual(transported?.bytes);
			expect(resource.bytes).not.toBe(transported?.bytes);
		}
	});

	it("preserves a stable server failure envelope as one typed repository failure", async () => {
		const { editor } = installEditorApi();
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
		const { editor } = installEditorApi();
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

	it("rejects an invalid Electron response as a typed repository failure", async () => {
		const { editor } = installEditorApi();
		vi.mocked(editor.readProject).mockResolvedValueOnce(
			success({
				...createProjectTransport(),
				title: "Metadata drift",
			}),
		);
		const repository = Effect.runSync(createElectronEditorProjectRepositoryFx);

		const failure = await readTypedFailure(repository.readProjectFx("project-one"));

		expect(failure.operation).toBe("read-project");
		expect(failure.message).toBe("The editor IPC response is invalid.");
	});

	it("keeps resource bytes typed across request and response boundaries", async () => {
		const { editor, project } = installEditorApi();
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
		});
		expect(
			(
				request?.resources[0] as {
					readonly bytes?: unknown;
				}
			).bytes,
		).toBeInstanceOf(Uint8Array);
		expect(
			(
				request?.resources[0] as {
					readonly bytes: Uint8Array;
				}
			).bytes,
		).toEqual(requestBytes);
		expect(saved.resources[0]?.bytes).toBeInstanceOf(Uint8Array);
		expect(saved.resources[0]?.bytes).not.toBe(project.resources[1]?.bytes);
	});
});

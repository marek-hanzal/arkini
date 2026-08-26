import { createId } from "@paralleldrive/cuid2";
import { Clock, FileSystem, Path } from "effect";
import { Effect, type Semaphore } from "effect";

import type { FilesystemEditorProjectState } from "../FilesystemEditorProjectState";
import { createEditorProjectFilesystemPathsFx } from "../createEditorProjectFilesystemPathsFx";
import type { FilesystemEditorProjectCatalog } from "./createFilesystemEditorProjectCatalogFx";
import type { EditorProject } from "~/editor/EditorProject";
import type { EditorProjectDescriptor } from "~/editor/EditorProjectDescriptor";
import type { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { EditorProjectFileSchema } from "~/editor/filesystem/EditorProjectFileSchema";
import { EditorProjectCatalogEntrySchema } from "~/editor/filesystem/EditorProjectCatalogEntrySchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { readFilesystemEditorProjectFilesFx } from "./readFilesystemEditorProjectFilesFx";
import { readFilesystemEditorProjectSidecarsFx } from "./readFilesystemEditorProjectSidecarsFx";
import { readFilesystemEditorProjectVersionHistoryFx } from "./readFilesystemEditorProjectVersionHistoryFx";
import { writeFilesystemEditorProjectFilesFx } from "./writeFilesystemEditorProjectFilesFx";
import { withFilesystemEditorProjectLockFx } from "./withFilesystemEditorProjectLockFx";

export interface FilesystemEditorProjectOperations {
	readonly createProjectFx: (
		props: EditorProjectRepository.CreateProjectProps,
	) => Effect.Effect<EditorProject, EditorProjectRepositoryError>;
	readonly deleteProjectFx: (
		projectId: string,
	) => Effect.Effect<void, EditorProjectRepositoryError>;
	readonly listProjectsFx: Effect.Effect<
		ReadonlyArray<EditorProjectDescriptor>,
		EditorProjectRepositoryError
	>;
	readonly openProjectFx: (
		props: EditorProjectRepository.OpenProjectProps,
	) => Effect.Effect<EditorProject, EditorProjectRepositoryError>;
	readonly readProjectFx: (
		projectId: string,
	) => Effect.Effect<EditorProject | null, EditorProjectRepositoryError>;
	readonly readProjectRootFx: (
		projectId: string,
	) => Effect.Effect<string | null, EditorProjectRepositoryError>;
	readonly refreshProjectFx: (
		projectId: string,
	) => Effect.Effect<EditorProject, EditorProjectRepositoryError>;
}

const cloneProject = (project: EditorProject): EditorProject => ({
	...project,
	config: GameConfigSchema.parse(project.config),
	resources: project.resources.map((resource) => ({
		...resource,
		bytes: resource.bytes.slice(),
	})),
});

const materializeDescriptor = ({
	projectId,
	title,
	version,
	createdAtMs,
	updatedAtMs,
}: EditorProject): EditorProjectDescriptor => ({
	projectId,
	title,
	version,
	createdAtMs,
	updatedAtMs,
});

const error = (
	operation:
		| "create-project"
		| "delete-project"
		| "list-projects"
		| "import-json-directory"
		| "read-project"
		| "refresh-project",
	message: string,
	cause?: unknown,
) =>
	cause instanceof EditorProjectRepositoryError && cause.operation === operation
		? cause
		: new EditorProjectRepositoryError({
				operation,
				message,
				cause,
			});

const materializeProjectFx = Effect.fn("materializeFilesystemEditorProjectFx")(function* (
	catalog: EditorProjectCatalogEntrySchema.Type,
) {
	return yield* withFilesystemEditorProjectLockFx(
		catalog.root,
		Effect.gen(function* () {
			const paths = yield* createEditorProjectFilesystemPathsFx(catalog.root);
			const files = yield* readFilesystemEditorProjectFilesFx(paths.root);
			const sidecars = yield* readFilesystemEditorProjectSidecarsFx({
				paths,
				projectId: catalog.projectId,
			});
			const versionHistory = yield* readFilesystemEditorProjectVersionHistoryFx(paths);
			return {
				catalog,
				...sidecars,
				paths,
				versionHistory,
				project: {
					projectId: catalog.projectId,
					title: files.config.meta.title,
					version: files.marker.arkpackVersion,
					createdAtMs: Math.min(catalog.createdAtMs, files.marker.updatedAtMs),
					updatedAtMs: files.marker.updatedAtMs,
					revision: files.marker.updatedAtMs,
					config: files.config,
					resources: files.resources,
				},
			} satisfies FilesystemEditorProjectState;
		}),
	);
});

export namespace createFilesystemEditorProjectOperationsFx {
	export interface Props {
		readonly catalog: FilesystemEditorProjectCatalog;
		readonly operations: Semaphore.Semaphore;
		readonly projectsRoot: string;
		readonly states: Map<string, FilesystemEditorProjectState>;
	}
}

/** Owns project discovery, managed creation, direct-folder open, hard refresh, and deletion. */
export const createFilesystemEditorProjectOperationsFx = Effect.fn(
	"createFilesystemEditorProjectOperationsFx",
)(function* ({
	catalog,
	operations,
	projectsRoot,
	states,
}: createFilesystemEditorProjectOperationsFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	yield* fileSystem.makeDirectory(projectsRoot, {
		recursive: true,
	});
	const managedProjectsRoot = yield* fileSystem.realPath(projectsRoot);
	const assertSafeCatalogEntryFx = (entry: EditorProjectCatalogEntrySchema.Type) =>
		Effect.gen(function* () {
			const root = yield* fileSystem.realPath(path.resolve(entry.root));
			if (entry.ownership === "managed") {
				const relative = path.relative(managedProjectsRoot, root);
				if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative))
					return yield* Effect.fail(
						new Error(
							`Managed Editor project ${entry.projectId} is outside the managed projects directory.`,
						),
					);
			}
			return EditorProjectCatalogEntrySchema.parse({
				...entry,
				root,
			});
		});
	const providePlatform = <Value, Failure, Requirements>(
		effect: Effect.Effect<Value, Failure, Requirements>,
	) =>
		effect.pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, path),
		);
	const materializeFx = (entry: EditorProjectCatalogEntrySchema.Type) =>
		assertSafeCatalogEntryFx(entry).pipe(
			Effect.flatMap((safeEntry) => providePlatform(materializeProjectFx(safeEntry))),
		);
	const writeProjectFx = (props: Parameters<typeof writeFilesystemEditorProjectFilesFx>[0]) =>
		providePlatform(writeFilesystemEditorProjectFilesFx(props));

	for (const entry of catalog.list()) {
		yield* materializeFx(entry).pipe(
			Effect.flatMap((state) => {
				const duplicateRoot = [
					...states.values(),
				].some(({ paths }) => paths.root === state.paths.root);
				return duplicateRoot
					? catalog.removeFx(entry.projectId).pipe(Effect.catch(() => Effect.void))
					: Effect.sync(() => states.set(entry.projectId, state));
			}),
			Effect.catch(() => Effect.void),
		);
	}

	const createProjectFx: FilesystemEditorProjectOperations["createProjectFx"] = ({
		projectId: candidateProjectId,
		version: candidateVersion,
		config: candidateConfig,
		resources: candidateResources,
	}) =>
		Effect.gen(function* () {
			const { projectId, version, config, resources } = yield* Effect.try({
				try: () => ({
					projectId: IdSchema.parse(candidateProjectId),
					version: ArkpackVersionSchema.parse(candidateVersion),
					config: GameConfigSchema.parse(candidateConfig),
					resources: ResourceSchema.array().parse(candidateResources),
				}),
				catch: (cause) => error("create-project", "The Editor project is invalid.", cause),
			});
			const nowMs = yield* Clock.currentTimeMillis;
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					if (states.has(projectId))
						return yield* Effect.fail(
							error("create-project", `Editor project ${projectId} already exists.`),
						);
					const root = path.join(
						projectsRoot,
						`${encodeURIComponent(projectId)}-${createId()}`,
					);
					yield* fileSystem.makeDirectory(root, {
						recursive: true,
					});
					const marker = EditorProjectFileSchema.parse({
						format: "arkini-editor",
						formatVersion: 1,
						arkpackVersion: version,
						updatedAtMs: nowMs,
					});
					yield* withFilesystemEditorProjectLockFx(
						root,
						writeProjectFx({
							root,
							next: {
								marker,
								config,
								resources,
							},
						}),
					);
					const entry = EditorProjectCatalogEntrySchema.parse({
						projectId,
						root: yield* fileSystem.realPath(root),
						ownership: "managed",
						createdAtMs: nowMs,
					});
					const state = yield* materializeFx(entry);
					yield* catalog.addFx(entry);
					states.set(projectId, state);
					return cloneProject(state.project);
				}),
			);
		}).pipe(
			Effect.mapError((cause) =>
				error(
					"create-project",
					`Editor project ${candidateProjectId} could not be created.`,
					cause,
				),
			),
		);

	const openProjectFx: FilesystemEditorProjectOperations["openProjectFx"] = ({
		root: candidateRoot,
	}) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const root = yield* fileSystem.realPath(path.resolve(candidateRoot));
				const existing = [
					...states.values(),
				].find((state) => state.catalog.root === root);
				if (existing !== undefined) return cloneProject(existing.project);
				const files = yield* withFilesystemEditorProjectLockFx(
					root,
					providePlatform(readFilesystemEditorProjectFilesFx(root)),
				);
				let projectId = files.config.meta.id;
				if (states.has(projectId)) projectId = `project-${createId()}`;
				const entry = EditorProjectCatalogEntrySchema.parse({
					projectId,
					root,
					ownership: "external",
					createdAtMs: files.marker.updatedAtMs,
				});
				const state = yield* materializeFx(entry);
				yield* catalog.addFx(entry);
				states.set(projectId, state);
				return cloneProject(state.project);
			}).pipe(
				Effect.mapError((cause) =>
					error(
						"import-json-directory",
						"The selected Editor project folder could not be opened.",
						cause,
					),
				),
			),
		);

	const listProjectsFx: FilesystemEditorProjectOperations["listProjectsFx"] =
		operations.withPermits(1)(
			Effect.sync(() =>
				[
					...states.values(),
				]
					.map(({ project }) => materializeDescriptor(project))
					.sort(
						(left, right) =>
							right.updatedAtMs - left.updatedAtMs ||
							left.projectId.localeCompare(right.projectId),
					),
			),
		);

	const readProjectFx: FilesystemEditorProjectOperations["readProjectFx"] = (projectId) =>
		operations.withPermits(1)(
			Effect.sync(() => {
				const state = states.get(projectId);
				return state === undefined ? null : cloneProject(state.project);
			}),
		);

	const readProjectRootFx: FilesystemEditorProjectOperations["readProjectRootFx"] = (projectId) =>
		operations.withPermits(1)(Effect.sync(() => states.get(projectId)?.paths.root ?? null));

	const refreshProjectFx: FilesystemEditorProjectOperations["refreshProjectFx"] = (projectId) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const current = states.get(projectId);
				if (current === undefined)
					return yield* Effect.fail(
						error("refresh-project", `Editor project ${projectId} does not exist.`),
					);
				const refreshed = yield* materializeFx(current.catalog);
				states.set(projectId, refreshed);
				return cloneProject(refreshed.project);
			}).pipe(
				Effect.mapError((cause) =>
					error(
						"refresh-project",
						`Editor project ${projectId} could not be refreshed from disk.`,
						cause,
					),
				),
			),
		);

	const deleteProjectFx: FilesystemEditorProjectOperations["deleteProjectFx"] = (projectId) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const state = states.get(projectId);
				if (state === undefined)
					return yield* Effect.fail(
						error("delete-project", `Editor project ${projectId} does not exist.`),
					);
				if (state.catalog.ownership === "managed")
					yield* withFilesystemEditorProjectLockFx(
						state.paths.root,
						assertSafeCatalogEntryFx(state.catalog).pipe(
							Effect.andThen(
								fileSystem.remove(state.paths.root, {
									recursive: true,
								}),
							),
						),
					);
				if (state.catalog.ownership === "managed") states.delete(projectId);
				yield* catalog.removeFx(projectId);
				states.delete(projectId);
			}).pipe(
				Effect.mapError((cause) =>
					error(
						"delete-project",
						`Editor project ${projectId} could not be deleted.`,
						cause,
					),
				),
			),
		);

	return {
		createProjectFx,
		deleteProjectFx,
		listProjectsFx,
		openProjectFx,
		readProjectFx,
		readProjectRootFx,
		refreshProjectFx,
	} satisfies FilesystemEditorProjectOperations;
});

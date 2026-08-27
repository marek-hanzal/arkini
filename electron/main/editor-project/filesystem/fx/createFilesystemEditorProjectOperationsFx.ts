import { createId } from "@paralleldrive/cuid2";
import { Clock, FileSystem, Path } from "effect";
import { Effect, type Semaphore } from "effect";

import { ArkiniAppVersion } from "../../../../../shared/ArkiniAppMetadata";
import type { FilesystemEditorProjectState } from "../FilesystemEditorProjectState";
import { createEditorProjectFilesystemPathsFx } from "../createEditorProjectFilesystemPathsFx";
import type { FilesystemEditorProjectCatalog } from "./createFilesystemEditorProjectCatalogFx";
import type { EditorProject } from "~/editor/EditorProject";
import type { EditorProjectDescriptor } from "~/editor/EditorProjectDescriptor";
import type { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { GameProjectManifestSchema } from "~/engine/source/schema/GameProjectManifestSchema";
import { EditorProjectCatalogEntrySchema } from "~/editor/filesystem/EditorProjectCatalogEntrySchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import type { FilesystemWrite } from "~/engine/filesystem/FilesystemWrite";
import { withFilesystemWriteRecovery } from "~/engine/filesystem/FilesystemWriteError";
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
				message: withFilesystemWriteRecovery(message, cause),
				cause,
			});

const materializeProjectFx = Effect.fn("materializeFilesystemEditorProjectFx")(function* (
	catalog: EditorProjectCatalogEntrySchema.Type,
	filesystemWrite: FilesystemWrite,
) {
	return yield* withFilesystemEditorProjectLockFx(
		filesystemWrite,
		catalog.root,
		Effect.gen(function* () {
			const paths = yield* createEditorProjectFilesystemPathsFx(catalog.root);
			const files = yield* readFilesystemEditorProjectFilesFx(paths.root);
			const projectId = files.config.meta.id;
			const sidecars = yield* readFilesystemEditorProjectSidecarsFx({
				paths,
				projectId,
			});
			const versionHistory = yield* readFilesystemEditorProjectVersionHistoryFx(paths);
			return {
				catalog,
				...sidecars,
				paths,
				versionHistory,
				project: {
					projectId,
					title: files.config.meta.title,
					version: files.arkpack,
					createdAtMs: Math.min(catalog.createdAtMs, files.marker.revision),
					updatedAtMs: files.marker.revision,
					revision: files.marker.revision,
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
		readonly filesystemWrite: FilesystemWrite;
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
	filesystemWrite,
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
	const lifecycleLock = path.join(managedProjectsRoot, ".projects.lock");
	const assertSafeCatalogEntryFx = (entry: EditorProjectCatalogEntrySchema.Type) =>
		Effect.gen(function* () {
			const root = yield* fileSystem.realPath(path.resolve(entry.root));
			if (entry.ownership === "managed") {
				const relative = path.relative(managedProjectsRoot, root);
				if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative))
					return yield* Effect.fail(
						new Error(
							`Managed Editor project root ${entry.root} is outside the managed projects directory.`,
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
			Effect.flatMap((safeEntry) =>
				providePlatform(materializeProjectFx(safeEntry, filesystemWrite)),
			),
		);
	const writeProjectFx = (props: Parameters<typeof writeFilesystemEditorProjectFilesFx>[0]) =>
		providePlatform(writeFilesystemEditorProjectFilesFx(props));

	yield* filesystemWrite.withLockFx(
		lifecycleLock,
		Effect.gen(function* () {
			const entries = catalog.list();
			const managedRoots = new Set(
				entries
					.filter((entry) => entry.ownership === "managed")
					.map((entry) => path.resolve(entry.root))
					.filter((root) => {
						const relative = path.relative(managedProjectsRoot, root);
						return (
							relative !== "" &&
							!relative.startsWith("..") &&
							!path.isAbsolute(relative)
						);
					}),
			);
			for (const entry of entries) {
				if (!(yield* fileSystem.exists(path.resolve(entry.root)))) {
					yield* catalog.removeFx(entry.root).pipe(Effect.catch(() => Effect.void));
					continue;
				}
				yield* materializeFx(entry).pipe(
					Effect.flatMap((state) => {
						const duplicateRoot = [
							...states.values(),
						].some(({ paths }) => paths.root === state.paths.root);
						if (duplicateRoot) return Effect.void;
						return states.has(state.project.projectId)
							? Effect.fail(
									new Error(
										`Editor project ID ${state.project.projectId} is duplicated by ${entry.root}.`,
									),
								)
							: Effect.sync(() => states.set(state.project.projectId, state));
					}),
					Effect.catch(() => Effect.void),
				);
			}
			for (const name of yield* fileSystem.readDirectory(managedProjectsRoot)) {
				if (name === ".projects.lock") continue;
				const candidate = path.join(managedProjectsRoot, name);
				if (managedRoots.has(candidate)) continue;
				if ((yield* fileSystem.realPath(candidate)) !== candidate) continue;
				yield* fileSystem.remove(candidate, {
					force: true,
					recursive: true,
				});
			}
		}),
	);

	const createProjectFx: FilesystemEditorProjectOperations["createProjectFx"] = ({
		version: candidateVersion,
		config: candidateConfig,
		resources: candidateResources,
	}) =>
		Effect.gen(function* () {
			const { projectId, version, config, resources } = yield* Effect.try({
				try: () => {
					const config = GameConfigSchema.parse(candidateConfig);
					return {
						projectId: config.meta.id,
						version: ArkpackVersionSchema.parse(candidateVersion),
						config,
						resources: ResourceSchema.array().parse(candidateResources),
					};
				},
				catch: (cause) => error("create-project", "The Editor project is invalid.", cause),
			});
			const nowMs = yield* Clock.currentTimeMillis;
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					if (states.has(projectId))
						return yield* Effect.fail(
							error("create-project", `Editor project ${projectId} already exists.`),
						);
					return yield* filesystemWrite.withLockFx(
						lifecycleLock,
						Effect.gen(function* () {
							const root = path.join(
								projectsRoot,
								`${encodeURIComponent(projectId)}-${createId()}`,
							);
							return yield* Effect.gen(function* () {
								yield* fileSystem.makeDirectory(root, {
									recursive: true,
								});
								const marker = GameProjectManifestSchema.parse({
									arkini: ArkiniAppVersion,
									revision: nowMs,
								});
								yield* writeProjectFx({
									root,
									next: {
										arkpack: version,
										marker,
										config,
										resources,
									},
								});
								const entry = EditorProjectCatalogEntrySchema.parse({
									root: yield* fileSystem.realPath(root),
									ownership: "managed",
									createdAtMs: nowMs,
								});
								const state = yield* materializeFx(entry);
								yield* catalog.addFx(entry);
								states.set(projectId, state);
								return cloneProject(state.project);
							}).pipe(
								Effect.onError(() =>
									fileSystem
										.remove(root, {
											force: true,
											recursive: true,
										})
										.pipe(Effect.ignore),
								),
							);
						}),
					);
				}),
			);
		}).pipe(
			Effect.mapError((cause) =>
				error("create-project", "The Editor project could not be created.", cause),
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
					filesystemWrite,
					root,
					providePlatform(readFilesystemEditorProjectFilesFx(root)),
				);
				const projectId = files.config.meta.id;
				if (states.has(projectId))
					return yield* Effect.fail(
						error(
							"import-json-directory",
							`Editor project ID ${projectId} is already open from another folder.`,
						),
					);
				const entry = EditorProjectCatalogEntrySchema.parse({
					root,
					ownership: "external",
					createdAtMs: files.marker.revision,
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
				if (
					refreshed.project.projectId !== projectId &&
					states.has(refreshed.project.projectId)
				)
					return yield* Effect.fail(
						error(
							"refresh-project",
							`Editor project ID ${refreshed.project.projectId} is already open from another folder.`,
						),
					);
				states.delete(projectId);
				states.set(refreshed.project.projectId, refreshed);
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
					yield* filesystemWrite.withLockFx(
						lifecycleLock,
						withFilesystemEditorProjectLockFx(
							filesystemWrite,
							state.paths.root,
							Effect.uninterruptible(
								assertSafeCatalogEntryFx(state.catalog).pipe(
									Effect.andThen(catalog.removeFx(state.catalog.root)),
									Effect.andThen(Effect.sync(() => states.delete(projectId))),
									Effect.andThen(
										fileSystem
											.remove(state.paths.root, {
												force: true,
												recursive: true,
											})
											.pipe(Effect.ignore),
									),
								),
							),
						),
					);
				else {
					yield* catalog.removeFx(state.catalog.root);
					states.delete(projectId);
				}
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

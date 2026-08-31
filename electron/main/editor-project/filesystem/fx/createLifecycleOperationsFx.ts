import { createId } from "@paralleldrive/cuid2";
import { Clock, FileSystem, Path } from "effect";
import { Effect, type Semaphore } from "effect";

import { ArkiniAppVersion } from "../../../../../shared/ArkiniAppMetadata";
import type { ProjectState } from "../ProjectState";
import { createProjectPathsFx } from "../createProjectPathsFx";
import type { ProjectCatalog } from "./createProjectCatalogFx";
import type { EditorProject } from "~/project-authoring/type/EditorProject";
import type { EditorProjectCandidate } from "~/project-authoring/schema/EditorProjectCandidateSchema";
import type { EditorProjectDescriptor } from "~/project-authoring/schema/EditorProjectDescriptorSchema";
import type { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/project-authoring/error/EditorProjectRepositoryError";
import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";
import { GameProjectManifestSchema } from "~/game-config-source/schema/GameProjectManifestSchema";
import { EditorProjectCatalogEntrySchema } from "~/project-authoring/schema/EditorProjectCatalogEntrySchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { ArkpackVersionSchema } from "~/game-version/schema/ArkpackVersionSchema";
import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";
import { withFilesystemWriteRecovery } from "~/filesystem-write/error/FilesystemWriteError";
import { readProjectFilesFx } from "./readProjectFilesFx";
import { readSidecarsFx } from "./readSidecarsFx";
import { readVersionHistoryFx } from "./readVersionHistoryFx";
import { withProjectLockFx } from "./withProjectLockFx";
import { writeProjectFilesFx } from "./writeProjectFilesFx";

interface LifecycleOperations {
	readonly createProjectFx: (
		props: EditorProjectRepository.CreateProjectProps,
	) => Effect.Effect<EditorProject, EditorProjectRepositoryError>;
	readonly deleteProjectFx: (
		projectId: string,
	) => Effect.Effect<void, EditorProjectRepositoryError>;
	readonly listProjectsFx: Effect.Effect<
		ReadonlyArray<EditorProjectCandidate>,
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

const readValidationError = (cause: unknown) =>
	cause instanceof Error ? cause.message : String(cause);

const encodeManagedProjectDirectoryStemFn = (projectId: string) =>
	encodeGameProjectFileStemFn(projectId).replaceAll("%2E", ".");

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

const materializeProjectFx = Effect.fn("materializeProjectFx")(function* (
	catalog: EditorProjectCatalogEntrySchema.Type,
	filesystemWrite: FilesystemWrite,
) {
	return yield* withProjectLockFx(
		filesystemWrite,
		catalog.root,
		Effect.gen(function* () {
			const paths = yield* createProjectPathsFx(catalog.root);
			const files = yield* readProjectFilesFx(paths.root);
			const projectId = files.config.meta.id;
			const sidecars = yield* readSidecarsFx({
				paths,
				projectId,
			});
			const versionHistory = yield* readVersionHistoryFx(paths);
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
			} satisfies ProjectState;
		}),
	);
});

export namespace createLifecycleOperationsFx {
	export interface Props {
		readonly catalog: ProjectCatalog;
		readonly filesystemWrite: FilesystemWrite;
		readonly operations: Semaphore.Semaphore;
		readonly projectsRoot: string;
		readonly states: Map<string, ProjectState>;
	}
}

/** Owns project discovery, managed creation, direct-folder open, hard refresh, and deletion. */
export const createLifecycleOperationsFx = Effect.fn("createLifecycleOperationsFx")(function* ({
	catalog,
	filesystemWrite,
	operations,
	projectsRoot,
	states,
}: createLifecycleOperationsFx.Props) {
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
	const writeProjectFx = (props: Parameters<typeof writeProjectFilesFx>[0]) =>
		providePlatform(writeProjectFilesFx(props));
	const readCandidatesFx = Effect.gen(function* () {
		const candidates: Array<EditorProjectCandidate> = [];
		const listedRoots = new Set<string>();
		for (const entry of catalog.list()) {
			const mounted = [
				...states.values(),
			].find(
				(state) =>
					state.catalog.root === entry.root &&
					state.catalog.ownership === entry.ownership,
			);
			if (mounted !== undefined) {
				if (listedRoots.has(mounted.paths.root)) {
					yield* catalog.removeFx(entry.root).pipe(Effect.catch(() => Effect.void));
					continue;
				}
				listedRoots.add(mounted.paths.root);
				candidates.push({
					type: "valid",
					ownership: mounted.catalog.ownership,
					project: materializeDescriptor(mounted.project),
				});
				continue;
			}
			if (!(yield* fileSystem.exists(path.resolve(entry.root)))) {
				yield* catalog.removeFx(entry.root).pipe(Effect.catch(() => Effect.void));
				continue;
			}
			const canonicalRoot = yield* fileSystem.realPath(path.resolve(entry.root));
			if (listedRoots.has(canonicalRoot)) {
				yield* catalog.removeFx(entry.root).pipe(Effect.catch(() => Effect.void));
				continue;
			}
			listedRoots.add(canonicalRoot);
			const existing = [
				...states.values(),
			].find(
				(state) =>
					state.paths.root === canonicalRoot &&
					state.catalog.ownership === entry.ownership,
			);
			if (existing !== undefined) {
				candidates.push({
					type: "valid",
					ownership: existing.catalog.ownership,
					project: materializeDescriptor(existing.project),
				});
				continue;
			}
			const materialized = yield* materializeFx(entry).pipe(
				Effect.map((state) => ({
					type: "success" as const,
					state,
				})),
				Effect.catch((cause) =>
					Effect.succeed({
						type: "failure" as const,
						cause,
					}),
				),
			);
			if (materialized.type === "failure") {
				candidates.push({
					type: "invalid",
					root: entry.root,
					title: path.basename(entry.root) || entry.root,
					validationError: readValidationError(materialized.cause),
				});
				continue;
			}
			const state = materialized.state;
			const duplicateRoot = [
				...states.values(),
			].some(({ paths }) => paths.root === state.paths.root);
			if (duplicateRoot) {
				yield* catalog.removeFx(entry.root).pipe(Effect.catch(() => Effect.void));
				continue;
			}
			if (states.has(state.project.projectId)) {
				candidates.push({
					type: "invalid",
					root: entry.root,
					title: path.basename(entry.root) || entry.root,
					validationError: `Editor project ID ${state.project.projectId} is duplicated by ${entry.root}.`,
				});
				continue;
			}
			states.set(state.project.projectId, state);
			candidates.push({
				type: "valid",
				ownership: state.catalog.ownership,
				project: materializeDescriptor(state.project),
			});
		}
		return candidates.sort((left, right) => {
			if (left.type === "valid" && right.type === "valid")
				return (
					right.project.updatedAtMs - left.project.updatedAtMs ||
					left.project.projectId.localeCompare(right.project.projectId)
				);
			if (left.type !== right.type) return left.type === "valid" ? -1 : 1;
			return left.type === "invalid" && right.type === "invalid"
				? left.root.localeCompare(right.root)
				: 0;
		});
	}).pipe(
		Effect.mapError((cause) =>
			error("list-projects", "The Editor project catalog could not be refreshed.", cause),
		),
	);

	yield* readCandidatesFx;

	const createProjectFx: LifecycleOperations["createProjectFx"] = ({
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
								`${encodeManagedProjectDirectoryStemFn(projectId)}-${createId()}`,
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

	const openProjectFx: LifecycleOperations["openProjectFx"] = ({ root: candidateRoot }) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const root = yield* fileSystem.realPath(path.resolve(candidateRoot));
				const existing = [
					...states.values(),
				].find((state) => state.catalog.root === root);
				if (existing !== undefined) return cloneProject(existing.project);
				const provisionalEntry = EditorProjectCatalogEntrySchema.parse({
					root,
					ownership: "external",
					createdAtMs: 0,
				});
				const provisionalState = yield* materializeFx(provisionalEntry);
				const projectId = provisionalState.project.projectId;
				if (states.has(projectId))
					return yield* Effect.fail(
						error(
							"import-json-directory",
							`Editor project ID ${projectId} is already open from another folder.`,
						),
					);
				const entry = EditorProjectCatalogEntrySchema.parse({
					...provisionalEntry,
					createdAtMs: provisionalState.project.updatedAtMs,
				});
				const state: ProjectState = {
					...provisionalState,
					catalog: entry,
					project: {
						...provisionalState.project,
						createdAtMs: entry.createdAtMs,
					},
				};
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

	const listProjectsFx: LifecycleOperations["listProjectsFx"] =
		operations.withPermits(1)(readCandidatesFx);

	const readProjectFx: LifecycleOperations["readProjectFx"] = (projectId) =>
		operations.withPermits(1)(
			Effect.sync(() => {
				const state = states.get(projectId);
				return state === undefined ? null : cloneProject(state.project);
			}),
		);

	const readProjectRootFx: LifecycleOperations["readProjectRootFx"] = (projectId) =>
		operations.withPermits(1)(Effect.sync(() => states.get(projectId)?.paths.root ?? null));

	const refreshProjectFx: LifecycleOperations["refreshProjectFx"] = (projectId) =>
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

	const deleteProjectFx: LifecycleOperations["deleteProjectFx"] = (projectId) =>
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
						Effect.uninterruptible(
							assertSafeCatalogEntryFx(state.catalog).pipe(
								Effect.andThen(
									fileSystem.remove(state.paths.root, {
										force: true,
										recursive: true,
									}),
								),
								Effect.andThen(Effect.sync(() => states.delete(projectId))),
								Effect.andThen(
									catalog.removeFx(state.catalog.root).pipe(Effect.ignore),
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
	} satisfies LifecycleOperations;
});

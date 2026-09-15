import {
	ProjectResourceFileReplacementSchema,
	ProjectResourceReplacementSchema,
} from "~/project-authoring/schema/ProjectResourceReplacementSchema";
import { Clock, FileSystem, Path } from "effect";
import { Effect, type Semaphore } from "effect";

import type { ProjectState } from "../ProjectState";
import type { Project, ProjectCommit } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import {
	ProjectRepositoryError,
	type ProjectRepositoryOperation,
} from "~/project-authoring/error/ProjectRepositoryError";
import { forceDeleteFx } from "~/item-authoring/fx/forceDeleteFx";
import { readEditorArtworkDeleteBlockersFn } from "~/artwork-authoring/fn/readEditorArtworkDeleteBlockersFn";
import { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";
import { GameProjectGameSchemaReference } from "~/game-config-source/constant/GameProjectReference";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { optimizePngResourceFileFx } from "~/game-config-resource/fx/optimizePngResourceFileFx";
import { validatePngResourceFileFx } from "~/game-config-resource/fx/validatePngResourceFileFx";
import { validateArtworkPngFileFx } from "~/game-config-resource/fx/validateArtworkPngFileFx";
import { validateOggOpusFileFx } from "~/game-config-resource/fx/validateOggOpusFileFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { withFilesystemWriteRecoveryFn } from "~/filesystem-write/fn/withFilesystemWriteRecoveryFn";
import { cloneProjectFn } from "~/project-authoring/fn/cloneProjectFn";
import { writeProjectChangesFx } from "./writeProjectChangesFx";
import type { ProjectResourceSchema } from "~/project-authoring/schema/ProjectResourceSchema";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";

type Operations = Pick<
	ProjectRepositoryService,
	| "deleteItemFx"
	| "deleteResourceFx"
	| "replaceConfigFx"
	| "optimizeResourcesFx"
	| "replaceResourceFx"
	| "upsertItemFx"
> &
	Pick<OwnedEditorProjectRepository, "upsertResourceFilesFx">;

const errorFn = (operation: ProjectRepositoryOperation, message: string, cause?: unknown) =>
	cause instanceof ProjectRepositoryError && cause.operation === operation
		? cause
		: new ProjectRepositoryError({
				operation,
				message: withFilesystemWriteRecoveryFn(message, cause),
				cause,
			});

const asCommitFn = (
	{ resources: _resources, ...project }: Project,
	previousRevision: number,
): ProjectCommit => ({
	...project,
	version: {
		...project.version,
	},
	config: GameConfigSchema.parse(project.config),
	previousRevision,
});

const assertExpectedRevisionFx = (
	state: ProjectState,
	expectedRevision: number,
	operation: ProjectRepositoryOperation,
) => {
	return state.project.revision === expectedRevision
		? Effect.void
		: Effect.fail(
				errorFn(
					operation,
					`Editor project ${state.project.projectId} changed from revision ${expectedRevision} to ${state.project.revision} before this write could commit.`,
				),
			);
};

export namespace createCommitOperationsFx {
	export interface Props {
		readonly operations: Semaphore.Semaphore;
		readonly readStateFx: (
			projectId: string,
		) => Effect.Effect<ProjectState, ProjectRepositoryError, never>;
		readonly states: Map<string, ProjectState>;
	}
}

/** Applies validated config/item/resource changes as ordered filesystem writes. */
export const createCommitOperationsFx = Effect.fn("createCommitOperationsFx")(function* ({
	operations,
	readStateFx,
	states,
}: createCommitOperationsFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const writeProjectFx = (props: Parameters<typeof writeProjectChangesFx>[0]) =>
		writeProjectChangesFx(props).pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, path),
		);

	const commitFx = Effect.fn("commitProjectFx")(function* ({
		allowProjectIdChange = false,
		state,
		config,
		resources,
		resourceFileWrites,
		resourceDelete,
		resourceRename,
		nowMs,
	}: {
		readonly allowProjectIdChange?: boolean;
		readonly state: ProjectState;
		readonly config: GameConfigSchema.Type;
		readonly resources: ReadonlyArray<ProjectResourceSchema.Type>;
		readonly resourceFileWrites?: ReadonlyArray<{
			readonly id: string;
			readonly path: string;
		}>;
		readonly resourceDelete?: string;
		readonly resourceRename?: {
			readonly from: string;
			readonly to: string;
		};
		readonly nowMs: number;
	}) {
		const canonicalConfig = GameConfigSchema.parse({
			...config,
			$schema: GameProjectGameSchemaReference,
		});
		const previousProjectId = state.project.projectId;
		const nextProjectId = canonicalConfig.meta.id;
		const projectIdChanged = nextProjectId !== previousProjectId;
		if (projectIdChanged && !allowProjectIdChange)
			return yield* Effect.fail(
				new Error("This Editor operation cannot change the project ID."),
			);
		if (projectIdChanged && states.has(nextProjectId))
			return yield* Effect.fail(
				errorFn("replace-config", `Editor project ID ${nextProjectId} is already open.`),
			);
		const updatedAtMs = Math.max(nowMs, state.project.updatedAtMs + 1);

		const nextProject: Project = {
			...state.project,
			projectId: nextProjectId,
			title: canonicalConfig.meta.title,
			version: state.project.version,
			updatedAtMs,
			revision: updatedAtMs,
			config: canonicalConfig,
			resources: [
				...resources,
			].sort((left, right) => left.id.localeCompare(right.id)),
		};
		// Reconcile against the completed config: force cleanup may remove additional owners.
		// Notes and the item tree are published from the same completed project projection.
		const remainingItemUids = new Set(
			Object.values(canonicalConfig.items).map((item) => item.uid),
		);
		const noteUpdatedAtMs = state.notes.reduce(
			(latest, note) => Math.max(latest, note.updatedAtMs + 1),
			nowMs,
		);
		const notes = state.notes.map((note) => {
			const itemUids = note.itemUids.filter((uid) => remainingItemUids.has(uid));
			const reconciledResourceIds =
				resourceRename === undefined
					? resourceDelete === undefined
						? note.resourceIds
						: note.resourceIds.filter((id) => id !== resourceDelete)
					: note.resourceIds.map((id) =>
							id === resourceRename.from ? resourceRename.to : id,
						);
			const resourceIds = [
				...new Set(reconciledResourceIds),
			];
			const resourceIdsChanged =
				resourceIds.length !== note.resourceIds.length ||
				resourceIds.some((id, index) => id !== note.resourceIds[index]);
			return itemUids.length === note.itemUids.length && !resourceIdsChanged
				? note
				: {
						...note,
						itemUids,
						resourceIds,
						updatedAtMs: noteUpdatedAtMs,
					};
		});
		const noteUpdates = notes.filter((note, index) => note !== state.notes[index]);
		const committedResources = yield* writeProjectFx({
			root: state.paths.root,
			previous: state.project,
			next: nextProject,
			resourceFileWrites,
			resourceRename,
			noteUpdates,
		});

		const nextState: ProjectState = {
			...state,
			notes: notes
				.map((note) => ({
					...note,
					projectId: nextProjectId,
					itemUids: [
						...note.itemUids,
					],
					resourceIds: [
						...note.resourceIds,
					],
				}))
				.sort(
					(left, right) =>
						right.updatedAtMs - left.updatedAtMs ||
						right.noteId.localeCompare(left.noteId),
				),
			project: {
				...nextProject,
				resources: committedResources,
			},
		};
		if (projectIdChanged) states.delete(previousProjectId);
		states.set(nextProjectId, nextState);
		return nextState.project;
	});

	const upsertItemFx: Operations["upsertItemFx"] = ({
		expectedRevision,
		projectId,
		item: candidateItem,
	}) =>
		Effect.gen(function* () {
			const item = yield* Effect.try({
				try: () => ItemSchema.parse(candidateItem),
				catch: (cause) => errorFn("upsert-item", "The Editor item is invalid.", cause),
			});
			const nowMs = yield* Clock.currentTimeMillis;
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readStateFx(projectId);
					if (expectedRevision !== undefined)
						yield* assertExpectedRevisionFx(state, expectedRevision, "upsert-item");
					const collision = state.project.config.items[item.id];
					if (collision !== undefined && collision.uid !== item.uid)
						return yield* Effect.fail(
							errorFn(
								"upsert-item",
								`Item ID ${item.id} is already used by another item.`,
							),
						);
					const previous = Object.entries(state.project.config.items).find(
						([, existing]) => existing.uid === item.uid,
					);
					if (previous !== undefined && previous[0] !== item.id)
						return yield* Effect.fail(
							errorFn(
								"upsert-item",
								`Saved item ${previous[0]} cannot be renamed without an explicit rename workflow.`,
							),
						);
					const config = GameConfigSchema.parse({
						...state.project.config,
						items: {
							...state.project.config.items,
							[item.id]: item,
						},
					});
					return asCommitFn(
						yield* commitFx({
							state,
							config,
							resources: state.project.resources,
							nowMs,
						}),
						state.project.revision,
					);
				}),
			);
		}).pipe(
			Effect.mapError((cause) =>
				errorFn(
					"upsert-item",
					`Item ${candidateItem.id} could not be saved in project ${projectId}.`,
					cause,
				),
			),
		);

	const deleteItemFx: Operations["deleteItemFx"] = ({
		expectedRevision,
		force,
		itemUid,
		projectId,
	}) =>
		Effect.gen(function* () {
			const nowMs = yield* Clock.currentTimeMillis;
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readStateFx(projectId);
					yield* assertExpectedRevisionFx(state, expectedRevision, "delete-item");
					const entry = Object.entries(state.project.config.items).find(
						([, item]) => item.uid === itemUid,
					);
					if (entry === undefined)
						return yield* Effect.fail(
							errorFn("delete-item", `Item UID ${itemUid} does not exist.`),
						);
					const [itemId] = entry;
					const blockers = readDeleteBlockersFn({
						config: state.project.config,
						itemId,
					});
					if (blockers.length > 0 && !force)
						return yield* Effect.fail(
							errorFn(
								"delete-item",
								`Item ${itemId} is still referenced in ${blockers.length} ${blockers.length === 1 ? "place" : "places"}.`,
							),
						);
					const config = force
						? (yield* forceDeleteFx({
								config: state.project.config,
								itemId,
							})).config
						: GameConfigSchema.parse({
								...state.project.config,
								items: Object.fromEntries(
									Object.entries(state.project.config.items).filter(
										([id]) => id !== itemId,
									),
								),
							});
					return asCommitFn(
						yield* commitFx({
							state,
							config,
							resources: state.project.resources,
							nowMs,
						}),
						state.project.revision,
					);
				}),
			);
		}).pipe(
			Effect.mapError((cause) =>
				errorFn(
					"delete-item",
					`Item UID ${itemUid} could not be deleted from project ${projectId}.`,
					cause,
				),
			),
		);

	const replaceConfigFx: Operations["replaceConfigFx"] = ({
		projectId,
		expectedRevision,
		config: candidate,
	}) =>
		Effect.gen(function* () {
			const config = yield* Effect.try({
				try: () => GameConfigSchema.parse(candidate),
				catch: (cause) =>
					errorFn("replace-config", "The Editor project config is invalid.", cause),
			});
			const nowMs = yield* Clock.currentTimeMillis;
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readStateFx(projectId);
					yield* assertExpectedRevisionFx(state, expectedRevision, "replace-config");
					return asCommitFn(
						yield* commitFx({
							allowProjectIdChange: true,
							state,
							config,
							resources: state.project.resources,
							nowMs,
						}),
						state.project.revision,
					);
				}),
			);
		}).pipe(
			Effect.mapError((cause) =>
				errorFn(
					"replace-config",
					`Project ${projectId} configuration could not be saved.`,
					cause,
				),
			),
		);

	const commitResourcesFx = (
		operation: ProjectRepositoryOperation,
		projectId: string,
		expectedRevision: number | undefined,
		changeFx: (state: ProjectState) => Effect.Effect<
			{
				readonly config: GameConfigSchema.Type;
				readonly resources: ReadonlyArray<ProjectResourceSchema.Type>;
				readonly resourceFileWrites?: ReadonlyArray<{
					readonly id: string;
					readonly path: string;
				}>;
				readonly resourceDelete?: string;
				readonly resourceRename?: {
					readonly from: string;
					readonly to: string;
				};
			},
			ProjectRepositoryError,
			never
		>,
	) =>
		Effect.gen(function* () {
			const nowMs = yield* Clock.currentTimeMillis;
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readStateFx(projectId);
					if (expectedRevision !== undefined)
						yield* assertExpectedRevisionFx(state, expectedRevision, operation);
					const next = yield* changeFx(state);
					return cloneProjectFn(
						yield* commitFx({
							state,
							config: next.config,
							resources: next.resources,
							resourceFileWrites: next.resourceFileWrites,
							...(next.resourceDelete === undefined
								? {}
								: {
										resourceDelete: next.resourceDelete,
									}),
							...(next.resourceRename === undefined
								? {}
								: {
										resourceRename: next.resourceRename,
									}),
							nowMs,
						}),
					);
				}),
			);
		});
	const assertDistinctResourceIdsFx = Effect.fn("assertDistinctResourceIdsFx")(function* <
		Resource extends {
			readonly id: string;
		},
	>(resources: ReadonlyArray<Resource>) {
		if (resources.length === 0)
			return yield* Effect.fail(
				errorFn("upsert-resource", "Select at least one resource to import."),
			);
		if (new Set(resources.map(({ id }) => id)).size !== resources.length)
			return yield* Effect.fail(
				errorFn(
					"upsert-resource",
					"A resource occurs more than once in the same Editor write.",
				),
			);
	});

	const upsertResourceFilesFx = ({
		projectId,
		resources,
	}: {
		readonly projectId: string;
		readonly resources: ReadonlyArray<{
			readonly id: string;
			readonly type: ProjectResourceSchema.Type["type"];
			readonly path: string;
			readonly size: number;
		}>;
	}) =>
		Effect.gen(function* () {
			yield* assertDistinctResourceIdsFx(resources);
			return yield* commitResourcesFx("upsert-resource", projectId, undefined, (state) => {
				const ids = new Set(resources.map(({ id }) => id));
				return Effect.succeed({
					config: state.project.config,
					resources: [
						...state.project.resources.filter(({ id }) => !ids.has(id)),
						...resources.map(({ id, type, size }) => ({
							id,
							type,
							size,
							version: "pending",
						})),
					],
					resourceFileWrites: resources,
				});
			});
		}).pipe(
			Effect.mapError((cause) =>
				errorFn(
					"upsert-resource",
					`Resources could not be saved in project ${projectId}.`,
					cause,
				),
			),
		);

	const optimizeResourcesFx: Operations["optimizeResourcesFx"] = ({
		expectedRevision,
		onProgressFn,
		projectId,
		resourceIds,
	}) =>
		operations
			.withPermits(1)(
				Effect.scoped(
					Effect.gen(function* () {
						const state = yield* readStateFx(projectId);
						yield* assertExpectedRevisionFx(
							state,
							expectedRevision,
							"optimize-resources",
						);
						if (resourceIds.length === 0)
							return yield* Effect.fail(
								errorFn(
									"optimize-resources",
									"At least one resource must be selected for optimization.",
								),
							);
						const selectedResourceIds = new Set(resourceIds);
						if (selectedResourceIds.size !== resourceIds.length)
							return yield* Effect.fail(
								errorFn(
									"optimize-resources",
									"Each selected resource may appear only once.",
								),
							);
						const resources = state.project.resources.filter(({ id }) =>
							selectedResourceIds.has(id),
						);
						if (resources.length !== resourceIds.length) {
							const currentResourceIds = new Set(
								state.project.resources.map(({ id }) => id),
							);
							const missingResourceIds = resourceIds.filter(
								(resourceId) => !currentResourceIds.has(resourceId),
							);
							return yield* Effect.fail(
								errorFn(
									"optimize-resources",
									`Selected resources do not exist in project ${projectId}: ${missingResourceIds.join(", ")}.`,
								),
							);
						}
						let completedResourceCount = 0;
						const totalResourceCount = resources.length;
						const temporary = yield* fileSystem.makeTempDirectoryScoped();
						if (resources.some(({ type }) => type !== "artwork"))
							return yield* Effect.fail(
								errorFn(
									"optimize-resources",
									"Only Artwork resources can be optimized.",
								),
							);
						yield* Effect.sync(() =>
							onProgressFn?.({
								completedResourceCount,
								phase: "optimizing",
								totalResourceCount,
							}),
						);
						const results = yield* Effect.forEach(
							resources,
							(resource) =>
								Effect.gen(function* () {
									const source = yield* state.paths.artworkFileFx(resource.id);
									const result = yield* optimizePngResourceFileFx(
										source,
										path.join(temporary, String(completedResourceCount)),
										resource.id,
									);
									return {
										...result,
										id: resource.id,
									};
								}).pipe(
									Effect.tap(() =>
										Effect.sync(() => {
											completedResourceCount += 1;
											onProgressFn?.({
												completedResourceCount,
												phase: "optimizing",
												totalResourceCount,
											});
										}),
									),
								),
							{
								concurrency: 1,
							},
						);
						const optimizedResourceCount = results.reduce(
							(count, result) => count + (result.changed ? 1 : 0),
							0,
						);
						const originalBytes = results.reduce(
							(total, result) => total + result.originalBytes,
							0,
						);
						const optimizedBytes = results.reduce(
							(total, result) => total + result.optimizedBytes,
							0,
						);
						const optimizedResources = new Map(
							results.map((result) => [
								result.id,
								result,
							]),
						);
						yield* Effect.sync(() =>
							onProgressFn?.({
								completedResourceCount,
								phase: "saving",
								totalResourceCount,
							}),
						);
						const project =
							optimizedResourceCount === 0
								? cloneProjectFn(state.project)
								: yield* commitFx({
										state,
										config: state.project.config,
										resources: state.project.resources.map((resource) =>
											optimizedResources.has(resource.id)
												? {
														...resource,
														size: optimizedResources.get(resource.id)!
															.optimizedBytes,
													}
												: resource,
										),
										resourceFileWrites: results
											.filter((result) => result.changed)
											.map((result) => ({
												id: result.id,
												path: result.path,
											})),
										nowMs: yield* Clock.currentTimeMillis,
									});
						return {
							optimizedResourceCount,
							originalBytes,
							optimizedBytes,
							processedResourceCount: results.length,
							project: cloneProjectFn(project),
						};
					}),
				),
			)
			.pipe(
				Effect.provideService(FileSystem.FileSystem, fileSystem),
				Effect.provideService(Path.Path, path),
				Effect.mapError((cause) =>
					errorFn(
						"optimize-resources",
						`Resources could not be optimized in project ${projectId}.`,
						cause,
					),
				),
			);

	const deleteResourceFx: Operations["deleteResourceFx"] = ({
		expectedRevision,
		projectId,
		resourceId,
	}) =>
		commitResourcesFx("delete-resource", projectId, expectedRevision, (state) =>
			Effect.gen(function* () {
				if (!state.project.resources.some(({ id }) => id === resourceId))
					return yield* Effect.fail(
						errorFn("delete-resource", `Resource ${resourceId} does not exist.`),
					);
				const blockers = readEditorArtworkDeleteBlockersFn({
					config: state.project.config,
					resourceId,
				});
				if (blockers.length > 0)
					return yield* Effect.fail(
						errorFn(
							"delete-resource",
							`Resource ${resourceId} is still referenced in ${blockers.length} ${blockers.length === 1 ? "place" : "places"}.`,
						),
					);
				return {
					config: state.project.config,
					resources: state.project.resources.filter(({ id }) => id !== resourceId),
					resourceDelete: resourceId,
				};
			}),
		).pipe(
			Effect.mapError((cause) =>
				errorFn(
					"delete-resource",
					`Resource ${resourceId} could not be deleted from project ${projectId}.`,
					cause,
				),
			),
		);

	const replaceResourceFx: Operations["replaceResourceFx"] = ({
		config: candidateConfig,
		currentId,
		expectedRevision,
		projectId,
		resource: candidateResource,
	}) =>
		Effect.gen(function* () {
			const config = yield* Effect.try({
				try: () => GameConfigSchema.parse(candidateConfig),
				catch: (cause) =>
					errorFn("replace-resource", "The resource references are invalid.", cause),
			});
			const parsedResource = yield* Effect.try({
				try: () => ProjectResourceReplacementSchema.parse(candidateResource),
				catch: (cause) =>
					errorFn("replace-resource", "The replacement resource is invalid.", cause),
			});
			const parsedFileResource =
				ProjectResourceFileReplacementSchema.safeParse(parsedResource);
			const resource = parsedFileResource.success
				? ProjectResourceReplacementSchema.parse({
						...parsedFileResource.data,
						size: yield* parsedFileResource.data.type === "artwork"
							? validateArtworkPngFileFx(
									parsedFileResource.data.path,
									parsedFileResource.data.id,
								)
							: parsedFileResource.data.type === "image"
								? validatePngResourceFileFx(
										parsedFileResource.data.path,
										parsedFileResource.data.id,
									)
								: validateOggOpusFileFx(
										parsedFileResource.data.path,
										parsedFileResource.data.id,
									),
					})
				: parsedResource;
			const fileResource = ProjectResourceFileReplacementSchema.safeParse(resource);
			return yield* commitResourcesFx(
				"replace-resource",
				projectId,
				expectedRevision,
				(state) => {
					const previousResource = state.project.resources.find(
						({ id }) => id === currentId,
					);
					if (previousResource === undefined)
						return Effect.fail(
							errorFn("replace-resource", `Resource ${currentId} does not exist.`),
						);
					if (
						resource.id !== currentId &&
						state.project.resources.some(({ id }) => id === resource.id)
					)
						return Effect.fail(
							errorFn(
								"replace-resource",
								`Resource ID ${resource.id} already exists.`,
							),
						);
					return Effect.succeed({
						config,
						resources: [
							...state.project.resources.filter(({ id }) => id !== currentId),
							{
								id: resource.id,
								type: resource.type,
								size: fileResource.success
									? fileResource.data.size
									: previousResource.size,
								version: previousResource.version,
							},
						],
						resourceFileWrites: !fileResource.success
							? []
							: [
									{
										id: resource.id,
										path: fileResource.data.path,
									},
								],
						...(resource.id === currentId
							? {}
							: {
									resourceRename: {
										from: currentId,
										to: resource.id,
									},
								}),
					});
				},
			);
		}).pipe(
			Effect.mapError((cause) =>
				errorFn("replace-resource", `Resource ${currentId} could not be updated.`, cause),
			),
		);

	return {
		deleteItemFx,
		deleteResourceFx,
		optimizeResourcesFx,
		replaceConfigFx,
		replaceResourceFx,
		upsertItemFx,
		upsertResourceFilesFx,
	} satisfies Operations;
});

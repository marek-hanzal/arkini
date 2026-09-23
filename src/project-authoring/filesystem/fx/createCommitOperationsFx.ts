import { isDeepStrictEqual } from "node:util";
import { readTemplateReferenceIssuesFn } from "~/item-authoring/fn/readTemplateReferenceIssuesFn";
import {
	ProjectResourceFileReplacementSchema,
	ProjectResourceReplacementSchema,
} from "~/project-authoring/schema/ProjectResourceReplacementSchema";
import { ResourceMetadataSchema } from "~/game-config-resource/schema/ResourceMetadataSchema";
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
import { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";
import { GameProjectGameSchemaReference } from "~/game-config-source/constant/GameProjectReference";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { optimizePngResourceFileFx } from "~/game-config-resource/fx/optimizePngResourceFileFx";
import { optimizeOggOpusResourceFileFx } from "~/game-config-resource/fx/optimizeOggOpusResourceFileFx";
import { validatePngResourceFileFx } from "~/game-config-resource/fx/validatePngResourceFileFx";
import { validateArtworkPngFileFx } from "~/game-config-resource/fx/validateArtworkPngFileFx";
import { validateOggOpusFileFx } from "~/game-config-resource/fx/validateOggOpusFileFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { cloneProjectFn } from "~/project-authoring/fn/cloneProjectFn";
import { writeProjectChangesFx } from "./writeProjectChangesFx";
import type { ProjectResourceSchema } from "~/project-authoring/schema/ProjectResourceSchema";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";

type Operations = Pick<
	ProjectRepositoryService,
	| "deleteItemFx"
	| "deleteResourceFx"
	| "saveResourceMetadataFx"
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
				message,
				cause,
			});

/** Validate edited items and references broken by template removal; unrelated drafts remain editable. */
const assertTemplateReferencesFx = Effect.fn("assertEditorTemplateReferencesFx")(function* (
	config: GameConfigSchema.Type,
	previous: GameConfigSchema.Type,
	operation: "upsert-item" | "replace-config",
) {
	const removedTemplate =
		previous.templates?.some(
			({ uid }) => !config.templates?.some((template) => template.uid === uid),
		) ?? false;
	for (const [itemUid, item] of Object.entries(config.items)) {
		const changed = !isDeepStrictEqual(previous.items[itemUid], item);
		if (!changed && !removedTemplate) continue;
		for (const issue of readTemplateReferenceIssuesFn(item, config.templates)) {
			if (!changed && !previous.templates?.some(({ uid }) => uid === issue.templateUid))
				continue;
			return yield* Effect.fail(
				errorFn(
					operation,
					`Item ${itemUid}, ${issue.path.join(".")}: template ${issue.templateUid} does not exist. Select an existing template.`,
				),
			);
		}
	}
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
				new ProjectRepositoryError({
					operation,
					reason: "revision-conflict",
					message: `Editor project ${state.project.projectId} changed from revision ${expectedRevision} to ${state.project.revision} before this write could commit.`,
				}),
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
		nowMs,
	}: {
		readonly allowProjectIdChange?: boolean;
		readonly state: ProjectState;
		readonly config: GameConfigSchema.Type;
		readonly resources: ReadonlyArray<ProjectResourceSchema.Type>;
		readonly resourceFileWrites?: ReadonlyArray<{
			readonly uid: string;
			readonly path: string;
		}>;
		readonly resourceDelete?: string;
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
			].sort((left, right) => left.uid.localeCompare(right.uid)),
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
			const reconciledResourceUids =
				resourceDelete === undefined
					? note.resourceUids
					: note.resourceUids.filter((uid) => uid !== resourceDelete);
			const resourceUids = [
				...new Set(reconciledResourceUids),
			];
			const resourceUidsChanged =
				resourceUids.length !== note.resourceUids.length ||
				resourceUids.some((uid, index) => uid !== note.resourceUids[index]);
			return itemUids.length === note.itemUids.length && !resourceUidsChanged
				? note
				: {
						...note,
						itemUids,
						resourceUids,
						updatedAtMs: noteUpdatedAtMs,
					};
		});
		const noteUpdates = notes.filter((note, index) => note !== state.notes[index]);
		const committedResources = yield* writeProjectFx({
			root: state.paths.root,
			previous: state.project,
			next: nextProject,
			resourceFileWrites,
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
					resourceUids: [
						...note.resourceUids,
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
					const config = GameConfigSchema.parse({
						...state.project.config,
						items: {
							...state.project.config.items,
							[item.uid]: item,
						},
					});
					yield* assertTemplateReferencesFx(config, state.project.config, "upsert-item");
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
					`Item ${candidateItem.uid} could not be saved in project ${projectId}.`,
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
					const blockers = readDeleteBlockersFn({
						config: state.project.config,
						itemUid,
					});
					if (blockers.length > 0 && !force)
						return yield* Effect.fail(
							errorFn(
								"delete-item",
								`Item ${itemUid} is still referenced in ${blockers.length} ${blockers.length === 1 ? "place" : "places"}.`,
							),
						);
					const config = force
						? (yield* forceDeleteFx({
								config: state.project.config,
								itemUid,
							})).config
						: GameConfigSchema.parse({
								...state.project.config,
								items: Object.fromEntries(
									Object.entries(state.project.config.items).filter(
										([uid]) => uid !== itemUid,
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
					yield* assertTemplateReferencesFx(
						config,
						state.project.config,
						"replace-config",
					);
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
					readonly uid: string;
					readonly path: string;
				}>;
				readonly resourceDelete?: string;
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
							nowMs,
						}),
					);
				}),
			);
		});
	const assertDistinctResourceUidsFx = Effect.fn("assertDistinctResourceUidsFx")(function* <
		Resource extends {
			readonly uid: string;
		},
	>(resources: ReadonlyArray<Resource>) {
		if (resources.length === 0)
			return yield* Effect.fail(
				errorFn("upsert-resource", "Select at least one resource to import."),
			);
		if (new Set(resources.map(({ uid }) => uid)).size !== resources.length)
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
			readonly uid: string;
			readonly type: ProjectResourceSchema.Type["type"];
			readonly path: string;
			readonly size: number;
			readonly title: string;
		}>;
	}) =>
		Effect.gen(function* () {
			yield* assertDistinctResourceUidsFx(resources);
			for (const resource of resources)
				yield* Effect.try({
					try: () =>
						ResourceMetadataSchema.parse({
							title: resource.title,
						}),
					catch: (cause) =>
						errorFn(
							"upsert-resource",
							`Resource ${resource.uid} has invalid metadata.`,
							cause,
						),
				});
			return yield* commitResourcesFx("upsert-resource", projectId, undefined, (state) => {
				for (const resource of resources) {
					const existing = state.project.resources.find(
						({ uid }) => uid === resource.uid,
					);
					if (existing !== undefined)
						return Effect.fail(
							errorFn(
								"upsert-resource",
								`Resource ID ${resource.uid} already exists.`,
							),
						);
				}
				return Effect.succeed({
					config: state.project.config,
					resources: [
						...state.project.resources,
						...resources.map(({ uid, type, size, title }) => ({
							uid,
							type,
							size,
							title,
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
		resourceUids,
		type,
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
						if (resourceUids.length === 0)
							return yield* Effect.fail(
								errorFn(
									"optimize-resources",
									"At least one resource must be selected for optimization.",
								),
							);
						const selectedResourceUids = new Set(resourceUids);
						if (selectedResourceUids.size !== resourceUids.length)
							return yield* Effect.fail(
								errorFn(
									"optimize-resources",
									"Each selected resource may appear only once.",
								),
							);
						const resources = state.project.resources.filter(({ uid }) =>
							selectedResourceUids.has(uid),
						);
						if (resources.length !== resourceUids.length) {
							const currentResourceUids = new Set(
								state.project.resources.map(({ uid }) => uid),
							);
							const missingResourceUids = resourceUids.filter(
								(resourceUid) => !currentResourceUids.has(resourceUid),
							);
							return yield* Effect.fail(
								errorFn(
									"optimize-resources",
									`Selected resources do not exist in project ${projectId}: ${missingResourceUids.join(", ")}.`,
								),
							);
						}
						let completedResourceCount = 0;
						const totalResourceCount = resources.length;
						const temporary = yield* fileSystem.makeTempDirectoryScoped();
						if (resources.some((resource) => resource.type !== type))
							return yield* Effect.fail(
								errorFn(
									"optimize-resources",
									`Only ${type} resources can be optimized by this operation.`,
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
									const source = yield* state.paths.resourceFileFx(resource);
									const targetPrefix = path.join(
										temporary,
										String(completedResourceCount),
									);
									const result = yield* type === "artwork"
										? optimizePngResourceFileFx(
												source,
												targetPrefix,
												resource.uid,
											)
										: optimizeOggOpusResourceFileFx(
												source,
												`${targetPrefix}.ogg`,
												resource.uid,
											);
									return {
										...result,
										uid: resource.uid,
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
								result.uid,
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
											optimizedResources.has(resource.uid)
												? {
														...resource,
														size: optimizedResources.get(resource.uid)!
															.optimizedBytes,
													}
												: resource,
										),
										resourceFileWrites: results
											.filter((result) => result.changed)
											.map((result) => ({
												uid: result.uid,
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

	const saveResourceMetadataFx: Operations["saveResourceMetadataFx"] = ({
		projectId,
		expectedRevision,
		resourceUid,
		title,
	}) =>
		commitResourcesFx("save-resource-metadata", projectId, expectedRevision, (state) =>
			Effect.gen(function* () {
				const resource = state.project.resources.find(({ uid }) => uid === resourceUid);
				if (resource === undefined)
					return yield* Effect.fail(
						errorFn(
							"save-resource-metadata",
							`Resource ${resourceUid} does not exist.`,
						),
					);
				const metadata = yield* Effect.try({
					try: () =>
						ResourceMetadataSchema.parse({
							title,
						}),
					catch: (cause) =>
						errorFn("save-resource-metadata", "The resource title is invalid.", cause),
				});
				return {
					config: state.project.config,
					resources: state.project.resources.map((entry) =>
						entry.uid === resourceUid
							? {
									...entry,
									title: metadata.title,
								}
							: entry,
					),
				};
			}),
		).pipe(
			Effect.mapError((cause) =>
				errorFn(
					"save-resource-metadata",
					`Resource ${resourceUid} metadata could not be saved in project ${projectId}.`,
					cause,
				),
			),
		);

	const deleteResourceFx: Operations["deleteResourceFx"] = ({
		expectedRevision,
		projectId,
		resourceUid,
	}) =>
		commitResourcesFx("delete-resource", projectId, expectedRevision, (state) =>
			Effect.gen(function* () {
				const resource = state.project.resources.find(({ uid }) => uid === resourceUid);
				if (resource === undefined)
					return yield* Effect.fail(
						errorFn("delete-resource", `Resource ${resourceUid} does not exist.`),
					);
				const withoutMusicReference =
					resource.type === "music"
						? GameConfigSchema.parse({
								...state.project.config,
								items: Object.fromEntries(
									Object.entries(state.project.config.items).map(
										([uid, item]) => {
											if (item.music !== resourceUid)
												return [
													uid,
													item,
												];
											const { music: _music, ...withoutMusic } = item;
											return [
												uid,
												withoutMusic,
											];
										},
									),
								),
								...(state.project.config.music === undefined
									? {}
									: {
											music: {
												...state.project.config.music,
												playlist:
													state.project.config.music.playlist.filter(
														(uid) => uid !== resourceUid,
													),
											},
										}),
							})
						: state.project.config;
				const config =
					resource.type === "sfx" && withoutMusicReference.sfx !== undefined
						? GameConfigSchema.parse({
								...withoutMusicReference,
								sfx: {
									...withoutMusicReference.sfx,
									events: Object.fromEntries(
										Object.entries(withoutMusicReference.sfx.events).filter(
											([, uid]) => uid !== resourceUid,
										),
									),
								},
							})
						: withoutMusicReference;
				const blockers = readGameResourceUsagesFn(config).filter(
					(usage) => usage.resourceUid === resourceUid,
				);
				if (blockers.length > 0)
					return yield* Effect.fail(
						errorFn(
							"delete-resource",
							`Resource ${resourceUid} is still referenced in ${blockers.length} ${blockers.length === 1 ? "place" : "places"}.`,
						),
					);
				return {
					config,
					resources: state.project.resources.filter(({ uid }) => uid !== resourceUid),
					resourceDelete: resourceUid,
				};
			}),
		).pipe(
			Effect.mapError((cause) =>
				errorFn(
					"delete-resource",
					`Resource ${resourceUid} could not be deleted from project ${projectId}.`,
					cause,
				),
			),
		);

	const replaceResourceFx: Operations["replaceResourceFx"] = ({
		resourceUid,
		expectedRevision,
		projectId,
		resource: candidateResource,
	}) =>
		Effect.gen(function* () {
			const resource = yield* Effect.try({
				try: () => ProjectResourceReplacementSchema.parse(candidateResource),
				catch: (cause) =>
					errorFn("replace-resource", "The replacement resource is invalid.", cause),
			});
			const fileResource = ProjectResourceFileReplacementSchema.safeParse(resource);
			const size = fileResource.success
				? yield* resource.type === "artwork"
						? validateArtworkPngFileFx(fileResource.data.path, resource.uid)
						: resource.type === "image"
							? validatePngResourceFileFx(fileResource.data.path, resource.uid)
							: validateOggOpusFileFx(fileResource.data.path, resource.uid)
				: undefined;
			return yield* commitResourcesFx(
				"replace-resource",
				projectId,
				expectedRevision,
				(state) => {
					const previous = state.project.resources.find(
						(entry) => entry.uid === resourceUid,
					);
					if (previous === undefined)
						return Effect.fail(
							errorFn("replace-resource", `Resource ${resourceUid} does not exist.`),
						);
					if (resource.uid !== resourceUid || resource.type !== previous.type)
						return Effect.fail(
							errorFn(
								"replace-resource",
								"Replacement must preserve its resource UID and type.",
							),
						);
					return Effect.succeed({
						config: state.project.config,
						resources: state.project.resources.map((entry) =>
							entry.uid === resourceUid
								? {
										...entry,
										title: resource.title,
										size: size ?? entry.size,
									}
								: entry,
						),
						resourceFileWrites: fileResource.success
							? [
									{
										uid: resourceUid,
										path: fileResource.data.path,
									},
								]
							: [],
					});
				},
			);
		}).pipe(
			Effect.mapError((cause) =>
				errorFn("replace-resource", `Resource ${resourceUid} could not be updated.`, cause),
			),
		);

	return {
		deleteItemFx,
		deleteResourceFx,
		saveResourceMetadataFx,
		optimizeResourcesFx,
		replaceConfigFx,
		replaceResourceFx,
		upsertItemFx,
		upsertResourceFilesFx,
	} satisfies Operations;
});

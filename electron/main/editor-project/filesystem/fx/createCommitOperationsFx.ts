import { Clock, FileSystem, Path } from "effect";
import { Effect, type Semaphore } from "effect";

import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import type { ProjectState } from "../ProjectState";
import type { Project, ProjectCommit } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import {
	ProjectRepositoryError,
	type ProjectRepositoryOperation,
} from "~/project-authoring/error/ProjectRepositoryError";
import { forceDeleteFx } from "~/item-authoring/fx/forceDeleteFx";
import { readEditorAssetDeleteBlockersFn } from "~/asset-authoring/fn/readEditorAssetDeleteBlockersFn";
import { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";
import { GameProjectGameSchemaReference } from "~/game-config-source/constant/GameProjectReference";
import { GameProjectManifestSchema } from "~/game-config-source/schema/GameProjectManifestSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { withFilesystemWriteRecoveryFn } from "~/filesystem-write/fn/withFilesystemWriteRecoveryFn";
import { writeProjectFilesFx } from "./writeProjectFilesFx";

type Operations = Pick<
	ProjectRepositoryService,
	| "deleteItemFx"
	| "deleteResourceFx"
	| "replaceConfigFx"
	| "replaceResourceFx"
	| "saveResourceFx"
	| "upsertItemFx"
	| "upsertResourcesFx"
>;

const errorFn = (operation: ProjectRepositoryOperation, message: string, cause?: unknown) =>
	cause instanceof ProjectRepositoryError && cause.operation === operation
		? cause
		: new ProjectRepositoryError({
				operation,
				message: withFilesystemWriteRecoveryFn(message, cause),
				cause,
			});

const cloneProjectFn = (project: Project): Project => ({
	...project,
	resources: project.resources.map((resource) => ({
		...resource,
		bytes: resource.bytes.slice(),
	})),
});

const asCommitFn = (
	{ resources: _resources, ...project }: Project,
	previousRevision: number,
): ProjectCommit => ({
	...project,
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
	const writeProjectFx = (props: Parameters<typeof writeProjectFilesFx>[0]) =>
		writeProjectFilesFx(props).pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, path),
		);

	const commitFx = Effect.fn("commitProjectFx")(function* ({
		allowProjectIdChange = false,
		state,
		config,
		resources,
		nowMs,
	}: {
		readonly allowProjectIdChange?: boolean;
		readonly state: ProjectState;
		readonly config: GameConfigSchema.Type;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
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
		const marker = GameProjectManifestSchema.parse({
			arkini: ArkiniAppVersion,
			revision: updatedAtMs,
		});
		const nextProject: Project = {
			...state.project,
			projectId: nextProjectId,
			title: canonicalConfig.meta.title,
			version: state.project.version,
			updatedAtMs,
			revision: updatedAtMs,
			config: canonicalConfig,
			resources: resources
				.map((resource) => ({
					...resource,
					bytes: resource.bytes.slice(),
				}))
				.sort((left, right) => left.id.localeCompare(right.id)),
		};
		yield* writeProjectFx({
			root: state.paths.root,
			previous: {
				arkpack: state.project.version,
				marker: GameProjectManifestSchema.parse({
					arkini: ArkiniAppVersion,
					revision: state.project.revision,
				}),
				config: state.project.config,
				resources: state.project.resources,
			},
			next: {
				arkpack: state.project.version,
				marker,
				config: canonicalConfig,
				resources,
			},
			removeVersionHead: projectIdChanged,
		});
		const nextState: ProjectState = {
			...state,
			notes: projectIdChanged
				? state.notes.map((note) => ({
						...note,
						projectId: nextProjectId,
					}))
				: state.notes,
			project: nextProject,
			scenarios: projectIdChanged
				? state.scenarios.map((scenario) => ({
						...scenario,
						projectId: nextProjectId,
					}))
				: state.scenarios,
			versionHistory: projectIdChanged
				? {
						versions: new Map(),
					}
				: state.versionHistory,
		};
		if (projectIdChanged) states.delete(previousProjectId);
		states.set(nextProjectId, nextState);
		return cloneProjectFn(nextProject);
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
				readonly resources: ReadonlyArray<ResourceSchema.Type>;
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
					return yield* commitFx({
						state,
						config: next.config,
						resources: next.resources,
						nowMs,
					});
				}),
			);
		});

	const saveResourceFx: Operations["saveResourceFx"] = ({
		expectedRevision,
		overwrite,
		projectId,
		resource: candidate,
	}) =>
		Effect.gen(function* () {
			const resource = yield* Effect.try({
				try: () => ResourceSchema.parse(candidate),
				catch: (cause) =>
					errorFn("save-resource", "The Editor resource is invalid.", cause),
			});
			return yield* commitResourcesFx(
				"save-resource",
				projectId,
				expectedRevision,
				(state) => {
					const exists = state.project.resources.some(({ id }) => id === resource.id);
					if (exists && !overwrite)
						return Effect.fail(
							errorFn("save-resource", `Resource ID ${resource.id} already exists.`),
						);
					return Effect.succeed({
						config: state.project.config,
						resources: [
							...state.project.resources.filter(({ id }) => id !== resource.id),
							resource,
						],
					});
				},
			);
		}).pipe(
			Effect.mapError((cause) =>
				errorFn(
					"save-resource",
					`Resource ${candidate.id} could not be saved in project ${projectId}.`,
					cause,
				),
			),
		);

	const upsertResourcesFx: Operations["upsertResourcesFx"] = ({
		projectId,
		resources: candidates,
	}) =>
		Effect.gen(function* () {
			const resources = yield* Effect.try({
				try: () => ResourceSchema.array().min(1).parse(candidates),
				catch: (cause) =>
					errorFn("upsert-resource", "The Editor resources are invalid.", cause),
			});
			if (new Set(resources.map(({ id }) => id)).size !== resources.length)
				return yield* Effect.fail(
					errorFn(
						"upsert-resource",
						"A resource occurs more than once in the same Editor write.",
					),
				);
			return yield* commitResourcesFx("upsert-resource", projectId, undefined, (state) => {
				const ids = new Set(resources.map(({ id }) => id));
				return Effect.succeed({
					config: state.project.config,
					resources: [
						...state.project.resources.filter(({ id }) => !ids.has(id)),
						...resources,
					],
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
				const blockers = readEditorAssetDeleteBlockersFn({
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
			const resource = yield* Effect.try({
				try: () => ResourceSchema.parse(candidateResource),
				catch: (cause) =>
					errorFn("replace-resource", "The replacement resource is invalid.", cause),
			});
			return yield* commitResourcesFx(
				"replace-resource",
				projectId,
				expectedRevision,
				(state) => {
					if (!state.project.resources.some(({ id }) => id === currentId))
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
							resource,
						],
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
		replaceConfigFx,
		replaceResourceFx,
		saveResourceFx,
		upsertItemFx,
		upsertResourcesFx,
	} satisfies Operations;
});

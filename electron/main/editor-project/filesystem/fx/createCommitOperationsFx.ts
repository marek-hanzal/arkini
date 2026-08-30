import { Clock, FileSystem, Path } from "effect";
import { Effect, type Semaphore } from "effect";

import { ArkiniAppVersion } from "../../../../../shared/ArkiniAppMetadata";
import type { ProjectState } from "../ProjectState";
import type { EditorProject, EditorProjectCommit } from "~/project-authoring/type/EditorProject";
import type { EditorProjectRepositoryService } from "~/project-authoring/service/EditorProjectRepository";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/project-authoring/error/EditorProjectRepositoryError";
import { forceDeleteEditorItemFx } from "~/item-authoring/fx/forceDeleteEditorItemFx";
import { readEditorAssetDeleteBlockersFn } from "~/asset-authoring/fn/readEditorAssetDeleteBlockersFn";
import { readEditorItemDeleteBlockersFn } from "~/item-authoring/fn/readEditorItemDeleteBlockersFn";
import { analyzeEditorProjectCompatibilityFn } from "~/project-version/fn/analyzeEditorProjectCompatibilityFn";
import { bumpArkpackVersionFn } from "~/project-version/fn/bumpArkpackVersionFn";
import { GameProjectGameSchemaReference } from "~/game-config/source/GameProjectReference";
import { GameProjectManifestSchema } from "~/game-config/source/schema/GameProjectManifestSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ResourceSchema } from "~/game-config/resource/schema/ResourceSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { withFilesystemWriteRecovery } from "~/engine/filesystem/FilesystemWriteError";
import { writeProjectFilesFx } from "./writeProjectFilesFx";

type Operations = Pick<
	EditorProjectRepositoryService,
	| "deleteItemFx"
	| "deleteResourceFx"
	| "replaceConfigFx"
	| "replaceResourceFx"
	| "saveResourceFx"
	| "upsertItemFx"
	| "upsertResourcesFx"
>;

const error = (operation: EditorProjectRepositoryOperation, message: string, cause?: unknown) =>
	cause instanceof EditorProjectRepositoryError && cause.operation === operation
		? cause
		: new EditorProjectRepositoryError({
				operation,
				message: withFilesystemWriteRecovery(message, cause),
				cause,
			});

const cloneProject = (project: EditorProject): EditorProject => ({
	...project,
	resources: project.resources.map((resource) => ({
		...resource,
		bytes: resource.bytes.slice(),
	})),
});

const asCommit = (
	{ resources: _resources, ...project }: EditorProject,
	previousRevision: number,
): EditorProjectCommit => ({
	...project,
	previousRevision,
});

const assertExpectedRevision = (
	state: ProjectState,
	expectedRevision: number,
	operation: EditorProjectRepositoryOperation,
) => {
	return state.project.revision === expectedRevision
		? Effect.void
		: Effect.fail(
				error(
					operation,
					`Editor project ${state.project.projectId} changed from revision ${expectedRevision} to ${state.project.revision} before this write could commit.`,
				),
			);
};

export namespace createCommitOperationsFx {
	export interface Props {
		readonly operations: Semaphore.Semaphore;
		readonly readState: (
			projectId: string,
		) => Effect.Effect<ProjectState, EditorProjectRepositoryError>;
		readonly states: Map<string, ProjectState>;
	}
}

/** Applies validated config/item/resource changes as ordered filesystem writes. */
export const createCommitOperationsFx = Effect.fn("createCommitOperationsFx")(function* ({
	operations,
	readState,
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
		state,
		config,
		resources,
		nowMs,
		minimumResult,
	}: {
		readonly state: ProjectState;
		readonly config: GameConfigSchema.Type;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
		readonly nowMs: number;
		readonly minimumResult?: "minor";
	}) {
		const canonicalConfig = GameConfigSchema.parse({
			...config,
			$schema: GameProjectGameSchemaReference,
		});
		if (canonicalConfig.meta.id !== state.project.projectId)
			return yield* Effect.fail(
				new Error("The Editor project ID can only change through Refresh from disk."),
			);
		const compatibility = analyzeEditorProjectCompatibilityFn(
			state.project.config,
			canonicalConfig,
		);
		const result =
			minimumResult === "minor" && compatibility.result === "noop"
				? "minor"
				: compatibility.result;
		const updatedAtMs = Math.max(nowMs, state.project.updatedAtMs + 1);
		const version = bumpArkpackVersionFn(state.project.version, result);
		const marker = GameProjectManifestSchema.parse({
			arkini: ArkiniAppVersion,
			revision: updatedAtMs,
		});
		const nextProject: EditorProject = {
			...state.project,
			title: canonicalConfig.meta.title,
			version,
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
				arkpack: version,
				marker,
				config: canonicalConfig,
				resources,
			},
		});
		states.set(state.project.projectId, {
			...state,
			project: nextProject,
		});
		return cloneProject(nextProject);
	});

	const upsertItemFx: Operations["upsertItemFx"] = ({
		expectedRevision,
		projectId,
		item: candidateItem,
	}) =>
		Effect.gen(function* () {
			const item = yield* Effect.try({
				try: () => ItemSchema.parse(candidateItem),
				catch: (cause) => error("upsert-item", "The Editor item is invalid.", cause),
			});
			const nowMs = yield* Clock.currentTimeMillis;
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readState(projectId);
					if (expectedRevision !== undefined)
						yield* assertExpectedRevision(state, expectedRevision, "upsert-item");
					const collision = state.project.config.items[item.id];
					if (collision !== undefined && collision.uid !== item.uid)
						return yield* Effect.fail(
							error(
								"upsert-item",
								`Item ID ${item.id} is already used by another item.`,
							),
						);
					const previous = Object.entries(state.project.config.items).find(
						([, existing]) => existing.uid === item.uid,
					);
					if (previous !== undefined && previous[0] !== item.id)
						return yield* Effect.fail(
							error(
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
					return asCommit(
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
				error(
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
					const state = yield* readState(projectId);
					yield* assertExpectedRevision(state, expectedRevision, "delete-item");
					const entry = Object.entries(state.project.config.items).find(
						([, item]) => item.uid === itemUid,
					);
					if (entry === undefined)
						return yield* Effect.fail(
							error("delete-item", `Item UID ${itemUid} does not exist.`),
						);
					const [itemId] = entry;
					const blockers = readEditorItemDeleteBlockersFn({
						config: state.project.config,
						itemId,
					});
					if (blockers.length > 0 && !force)
						return yield* Effect.fail(
							error(
								"delete-item",
								`Item ${itemId} is still referenced in ${blockers.length} ${blockers.length === 1 ? "place" : "places"}.`,
							),
						);
					const config = force
						? (yield* forceDeleteEditorItemFx({
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
					return asCommit(
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
				error(
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
					error("replace-config", "The Editor project config is invalid.", cause),
			});
			const nowMs = yield* Clock.currentTimeMillis;
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readState(projectId);
					yield* assertExpectedRevision(state, expectedRevision, "replace-config");
					return asCommit(
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
				error(
					"replace-config",
					`Project ${projectId} configuration could not be saved.`,
					cause,
				),
			),
		);

	const commitResourcesFx = (
		operation: EditorProjectRepositoryOperation,
		projectId: string,
		expectedRevision: number | undefined,
		change: (state: ProjectState) => Effect.Effect<
			{
				readonly config: GameConfigSchema.Type;
				readonly resources: ReadonlyArray<ResourceSchema.Type>;
			},
			EditorProjectRepositoryError
		>,
	) =>
		Effect.gen(function* () {
			const nowMs = yield* Clock.currentTimeMillis;
			return yield* operations.withPermits(1)(
				Effect.gen(function* () {
					const state = yield* readState(projectId);
					if (expectedRevision !== undefined)
						yield* assertExpectedRevision(state, expectedRevision, operation);
					const next = yield* change(state);
					return yield* commitFx({
						state,
						config: next.config,
						resources: next.resources,
						nowMs,
						minimumResult: "minor",
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
				catch: (cause) => error("save-resource", "The Editor resource is invalid.", cause),
			});
			return yield* commitResourcesFx(
				"save-resource",
				projectId,
				expectedRevision,
				(state) => {
					const exists = state.project.resources.some(({ id }) => id === resource.id);
					if (exists && !overwrite)
						return Effect.fail(
							error("save-resource", `Resource ID ${resource.id} already exists.`),
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
				error(
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
					error("upsert-resource", "The Editor resources are invalid.", cause),
			});
			if (new Set(resources.map(({ id }) => id)).size !== resources.length)
				return yield* Effect.fail(
					error(
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
				error(
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
						error("delete-resource", `Resource ${resourceId} does not exist.`),
					);
				const blockers = readEditorAssetDeleteBlockersFn({
					config: state.project.config,
					resourceId,
				});
				if (blockers.length > 0)
					return yield* Effect.fail(
						error(
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
				error(
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
					error("replace-resource", "The resource references are invalid.", cause),
			});
			const resource = yield* Effect.try({
				try: () => ResourceSchema.parse(candidateResource),
				catch: (cause) =>
					error("replace-resource", "The replacement resource is invalid.", cause),
			});
			return yield* commitResourcesFx(
				"replace-resource",
				projectId,
				expectedRevision,
				(state) => {
					if (!state.project.resources.some(({ id }) => id === currentId))
						return Effect.fail(
							error("replace-resource", `Resource ${currentId} does not exist.`),
						);
					if (
						resource.id !== currentId &&
						state.project.resources.some(({ id }) => id === resource.id)
					)
						return Effect.fail(
							error("replace-resource", `Resource ID ${resource.id} already exists.`),
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
				error("replace-resource", `Resource ${currentId} could not be updated.`, cause),
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

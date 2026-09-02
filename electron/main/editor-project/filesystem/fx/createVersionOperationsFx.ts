import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { Clock, FileSystem, Path } from "effect";
import { Effect, type Semaphore } from "effect";

import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import type { ProjectState } from "../ProjectState";
import type { Project } from "~/project-authoring/type/Project";
import {
	ProjectRepositoryError,
	type ProjectRepositoryOperation,
} from "~/project-authoring/error/ProjectRepositoryError";
import type { BoardScenarioSchema } from "~/board-scenario/schema/BoardScenarioSchema";
import { BoardScenarioFileSchema } from "~/board-scenario/schema/BoardScenarioFileSchema";
import { GameProjectManifestSchema } from "~/game-config-source/schema/GameProjectManifestSchema";
import { VersionDescriptorFileSchema } from "~/project-version/schema/VersionDescriptorFileSchema";
import { VersionHeadFileSchema } from "~/project-version/schema/VersionHeadFileSchema";
import type {
	ProjectVersionDescriptor,
	ProjectVersionRepositoryService,
} from "~/project-version/type/ProjectVersion";
import { createProjectVersionDiffFn } from "~/project-version/fn/createProjectVersionDiffFn";
import { createProjectVersionCommitPreviewFn } from "~/project-version/fn/createProjectVersionCommitPreviewFn";
import {
	ProjectVersionBodySchema,
	ProjectVersionSubjectSchema,
	ProjectVersionTagSchema,
} from "~/project-version/schema/ProjectVersionMetadataSchema";
import { createVersionReaderFx } from "./createVersionReaderFx";
import { createVersionSnapshotFx } from "./createVersionSnapshotFx";
import { planVersionSnapshotFx } from "~/project-version/fx/planVersionSnapshotFx";
import { assertProjectDirectoryFx } from "./assertProjectDirectoryFx";
import { readVersionSnapshotFx } from "~/project-version/fx/readVersionSnapshotFx";
import { withProjectLockFx } from "./withProjectLockFx";
import { writeProjectFilesFx } from "./writeProjectFilesFx";
import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";
import { withFilesystemWriteRecoveryFn } from "~/filesystem-write/fn/withFilesystemWriteRecoveryFn";

const encoder = new TextEncoder();

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

const materializeDescriptorFn = (
	projectId: string,
	versionId: string,
	file: VersionDescriptorFileSchema.Type,
): ProjectVersionDescriptor => ({
	arkini: file.arkini,
	arkpackVersion: file.version,
	...(file.body === undefined
		? {}
		: {
				body: file.body,
			}),
	createdAtMs: file.createdAtMs,
	...(file.parentVersionId === undefined
		? {}
		: {
				parentVersionId: file.parentVersionId,
			}),
	projectId,
	sourceRevision: file.sourceRevision,
	subject: file.subject,
	...(file.tag === undefined
		? {}
		: {
				tag: file.tag,
			}),
	versionId,
});

const sameCommitFn = (
	file: VersionDescriptorFileSchema.Type,
	metadata: {
		readonly body?: string;
		readonly subject: string;
		readonly tag?: string;
	},
	fingerprint: string,
) =>
	file.contentFingerprint === fingerprint &&
	file.subject === metadata.subject &&
	file.body === metadata.body &&
	file.tag === metadata.tag;

const toScenarioFn = (
	projectId: string,
	file: BoardScenarioFileSchema.Type,
): BoardScenarioSchema.Type => ({
	projectId,
	name: file.name,
	projectRevision: file.revision,
	version: file.version,
	bytes: Uint8Array.from(Buffer.from(file.save, "base64")),
	createdAtMs: file.createdAtMs,
	updatedAtMs: file.updatedAtMs,
});

export namespace createVersionOperationsFx {
	export interface Props {
		readonly filesystemWrite: FilesystemWrite;
		readonly operations: Semaphore.Semaphore;
		readonly readStateFx: (
			projectId: string,
		) => Effect.Effect<ProjectState, ProjectRepositoryError, never>;
		readonly states: Map<string, ProjectState>;
	}
}

/** Owns published full-snapshot history for filesystem Editor projects. */
export const createVersionOperationsFx = Effect.fn("createVersionOperationsFx")(function* ({
	filesystemWrite,
	operations,
	readStateFx,
	states,
}: createVersionOperationsFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const pathService = yield* Path.Path;
	const providePlatformFx = <Value, Failure, Requirements>(
		effect: Effect.Effect<Value, Failure, Requirements>,
	) =>
		effect.pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, pathService),
		);
	const writeJsonFx = (state: ProjectState, target: string, value: unknown) =>
		filesystemWrite.replaceFileFx({
			lock: pathService.join(state.paths.root, "editor.lock"),
			target,
			bytes: encoder.encode(`${JSON.stringify(value, undefined, "\t")}\n`),
		});
	const assertVersionDirectoryFx = (state: ProjectState) =>
		providePlatformFx(
			Effect.gen(function* () {
				yield* fileSystem.makeDirectory(state.paths.versions, {
					recursive: true,
				});
				yield* assertProjectDirectoryFx({
					root: state.paths.root,
					directory: state.paths.versions,
				});
			}),
		);
	const {
		readCurrentSnapshotFx,
		readDescriptorFx,
		readDiffSnapshotFx,
		readHeadFx,
		readPublishedVersionFx,
	} = yield* createVersionReaderFx({
		readStateFx,
	});
	const readCommitPreviewFx = Effect.fn("readProjectVersionCommitPreviewFx")(function* (
		current: {
			readonly contentFingerprint: string;
			readonly state: ProjectState;
		},
		head: VersionHeadFileSchema.Type | undefined,
	) {
		const { state } = current;
		if (head === undefined)
			return createProjectVersionCommitPreviewFn({
				baseArkpackVersion: state.project.version,
				currentFingerprint: current.contentFingerprint,
				currentScenarioNames: state.scenarios.map(({ name }) => name),
			});
		const base = yield* readDescriptorFx(state, head.current);
		const from = {
			type: "version" as const,
			versionId: head.current,
		};
		const to = {
			type: "current" as const,
		};
		return createProjectVersionCommitPreviewFn({
			baseArkpackVersion: base.version,
			currentFingerprint: current.contentFingerprint,
			currentScenarioNames: state.scenarios.map(({ name }) => name),
			diff: createProjectVersionDiffFn(
				from,
				to,
				yield* readDiffSnapshotFx(state, from),
				yield* readDiffSnapshotFx(state, to),
			),
		});
	});

	const listVersionsFx: ProjectVersionRepositoryService["listVersionsFx"] = (projectId) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const state = yield* readStateFx(projectId);
				const head = yield* readHeadFx(state);
				if (head === undefined) return [];
				const descriptors = yield* Effect.forEach(head.versions, (versionId) =>
					readDescriptorFx(state, versionId).pipe(
						Effect.map((descriptor) => ({
							descriptor,
							versionId,
						})),
					),
				);
				return descriptors
					.sort(
						(left, right) =>
							right.descriptor.createdAtMs - left.descriptor.createdAtMs ||
							left.versionId.localeCompare(right.versionId),
					)
					.map(({ descriptor, versionId }) =>
						materializeDescriptorFn(projectId, versionId, descriptor),
					);
			}).pipe(
				Effect.mapError((cause) =>
					errorFn(
						"list-versions",
						`Versions for project ${projectId} could not be listed.`,
						cause,
					),
				),
			),
		);

	const readVersionStatusFx: ProjectVersionRepositoryService["readVersionStatusFx"] = (
		projectId,
	) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const current = yield* readCurrentSnapshotFx(projectId);
				const head = yield* readHeadFx(current.state);
				const base =
					head === undefined
						? undefined
						: yield* readDescriptorFx(current.state, head.current);
				const dirty = base?.contentFingerprint !== current.contentFingerprint;
				return {
					canCommit: dirty,
					...(head === undefined
						? {}
						: {
								currentBaseVersionId: head.current,
							}),
					currentFingerprint: current.contentFingerprint,
					dirty,
					versionCount: head?.versions.length ?? 0,
				};
			}).pipe(
				Effect.mapError((cause) =>
					errorFn(
						"read-version-status",
						`Version status for project ${projectId} could not be read.`,
						cause,
					),
				),
			),
		);

	const previewVersionCommitFx: ProjectVersionRepositoryService["previewVersionCommitFx"] = (
		projectId,
	) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const current = yield* readCurrentSnapshotFx(projectId);
				return yield* readCommitPreviewFx(current, yield* readHeadFx(current.state));
			}).pipe(
				Effect.mapError((cause) =>
					errorFn(
						"preview-version-commit",
						`Version commit for project ${projectId} could not be previewed.`,
						cause,
					),
				),
			),
		);

	const createVersionFx: ProjectVersionRepositoryService["createVersionFx"] = ({
		body: bodyCandidate,
		expectedFingerprint,
		projectId,
		subject: subjectCandidate,
		tag: tagCandidate,
	}) =>
		Effect.gen(function* () {
			const metadata = yield* Effect.try({
				try: () => ({
					subject: ProjectVersionSubjectSchema.parse(subjectCandidate),
					...(bodyCandidate === undefined
						? {}
						: {
								body: ProjectVersionBodySchema.parse(bodyCandidate),
							}),
					...(tagCandidate === undefined
						? {}
						: {
								tag: ProjectVersionTagSchema.parse(tagCandidate),
							}),
				}),
				catch: (cause) =>
					errorFn("create-version", "The Editor version metadata is invalid.", cause),
			});
			const clockMs = yield* Clock.currentTimeMillis;
			return yield* operations
				.withPermits(1)(
					Effect.gen(function* () {
						const current = yield* readCurrentSnapshotFx(projectId);
						if (
							expectedFingerprint !== undefined &&
							expectedFingerprint !== current.contentFingerprint
						)
							return yield* Effect.fail(
								errorFn(
									"create-version",
									"The Editor project changed after its version preview was read.",
								),
							);
						const head = yield* readHeadFx(current.state);
						const base =
							head === undefined
								? undefined
								: yield* readDescriptorFx(current.state, head.current);
						if (
							head !== undefined &&
							base !== undefined &&
							sameCommitFn(base, metadata, current.contentFingerprint)
						)
							return materializeDescriptorFn(projectId, head.current, base);
						if (base?.contentFingerprint === current.contentFingerprint)
							return yield* Effect.fail(
								errorFn(
									"create-version",
									"The Editor project has no changes to commit.",
								),
							);

						const preview = yield* readCommitPreviewFx(current, head);
						const nextScenarios =
							preview.bump === "major" ? [] : current.state.scenarios;
						const scenarioFiles = nextScenarios.map((scenario) =>
							BoardScenarioFileSchema.parse({
								name: scenario.name,
								revision: scenario.projectRevision,
								version: scenario.version,
								save: Buffer.from(scenario.bytes).toString("base64"),
								createdAtMs: scenario.createdAtMs,
								updatedAtMs: scenario.updatedAtMs,
							}),
						);
						const changesCurrentProject =
							!preview.initial &&
							(preview.bump !== "noop" || preview.scenariosToDelete.length > 0);
						const updatedAtMs = changesCurrentProject
							? Math.max(clockMs, current.state.project.updatedAtMs + 1)
							: current.state.project.updatedAtMs;
						const nextProject = cloneProjectFn({
							...current.state.project,
							version: preview.nextArkpackVersion,
							updatedAtMs,
							revision: changesCurrentProject
								? updatedAtMs
								: current.state.project.revision,
						});
						const finalPlan = yield* planVersionSnapshotFx({
							arkpack: nextProject.version,
							config: nextProject.config,
							resources: nextProject.resources,
							scenarios: scenarioFiles,
						});
						const versionId = `v-${createHash("sha256")
							.update(
								JSON.stringify({
									parentVersionId: head?.current,
									contentFingerprint: finalPlan.contentFingerprint,
									...metadata,
								}),
							)
							.digest("hex")}`;
						const existingVersion =
							head !== undefined && head.versions.includes(versionId)
								? yield* readPublishedVersionFx(current.state, versionId)
								: undefined;
						if (
							existingVersion !== undefined &&
							(!sameCommitFn(
								existingVersion.descriptor,
								metadata,
								finalPlan.contentFingerprint,
							) ||
								existingVersion.descriptor.parentVersionId !== head?.current ||
								existingVersion.descriptor.version !== nextProject.version)
						)
							return yield* Effect.fail(
								new Error(
									`Version ${versionId} conflicts with its immutable identity.`,
								),
							);
						const latestCreatedAt =
							head === undefined || existingVersion !== undefined
								? undefined
								: Math.max(
										...(yield* Effect.forEach(head.versions, (id) =>
											readDescriptorFx(current.state, id).pipe(
												Effect.map((descriptor) => descriptor.createdAtMs),
											),
										)),
									);
						const descriptor =
							existingVersion?.descriptor ??
							VersionDescriptorFileSchema.parse({
								...(head === undefined
									? {}
									: {
											parentVersionId: head.current,
										}),
								...metadata,
								arkini: ArkiniAppVersion,
								version: nextProject.version,
								sourceRevision: nextProject.revision,
								contentFingerprint: finalPlan.contentFingerprint,
								createdAtMs:
									latestCreatedAt === undefined
										? clockMs
										: Math.max(clockMs, latestCreatedAt + 1),
							});
						const nextHead = VersionHeadFileSchema.parse({
							current: versionId,
							versions: [
								...(head?.versions ?? []),
								...(head?.versions.includes(versionId)
									? []
									: [
											versionId,
										]),
							],
						});

						const snapshot = yield* withProjectLockFx(
							filesystemWrite,
							current.state.paths.root,
							Effect.gen(function* () {
								yield* assertVersionDirectoryFx(current.state);
								const snapshot =
									existingVersion === undefined
										? yield* providePlatformFx(
												createVersionSnapshotFx({
													arkpack: nextProject.version,
													config: nextProject.config,
													filesystemWrite,
													resources: nextProject.resources,
													scenarios: nextScenarios,
													paths: current.state.paths,
												}),
											)
										: yield* providePlatformFx(
												readVersionSnapshotFx({
													manifest: existingVersion.manifest,
													root: current.state.paths.root,
												}).pipe(
													Effect.map((snapshot) => ({
														...snapshot,
														manifest: existingVersion.manifest,
													})),
												),
											);
								if (snapshot.contentFingerprint !== finalPlan.contentFingerprint)
									return yield* Effect.fail(
										new Error(
											"The Editor version snapshot changed while it was prepared.",
										),
									);
								if (existingVersion === undefined) {
									const directory =
										yield* current.state.paths.versionDirectoryFx(versionId);
									yield* fileSystem.makeDirectory(directory, {
										recursive: true,
									});
									yield* writeJsonFx(
										current.state,
										yield* current.state.paths.versionManifestFileFx(versionId),
										snapshot.manifest,
									);
									yield* writeJsonFx(
										current.state,
										yield* current.state.paths.versionDescriptorFileFx(
											versionId,
										),
										descriptor,
									);
								}
								yield* providePlatformFx(
									writeProjectFilesFx({
										root: current.state.paths.root,
										previous: {
											arkpack: current.state.project.version,
											marker: GameProjectManifestSchema.parse({
												arkini: ArkiniAppVersion,
												revision: current.state.project.revision,
											}),
											config: current.state.project.config,
											resources: current.state.project.resources,
										},
										next: {
											arkpack: nextProject.version,
											marker: GameProjectManifestSchema.parse({
												arkini: ArkiniAppVersion,
												revision: nextProject.revision,
											}),
											config: nextProject.config,
											resources: nextProject.resources,
										},
										...(preview.bump === "major"
											? {
													previousScenarioNames:
														current.state.scenarios.map(
															({ name }) => name,
														),
													scenarios: scenarioFiles,
												}
											: {}),
										versionHead: nextHead,
									}),
								);
								return snapshot;
							}),
						);
						const versions = new Map(current.state.versionHistory.versions);
						versions.set(versionId, {
							descriptor,
							manifest: snapshot.manifest,
						});
						states.set(projectId, {
							...current.state,
							project: nextProject,
							scenarios: nextScenarios,
							versionHistory: {
								head: nextHead,
								versions,
							},
						});
						return materializeDescriptorFn(projectId, versionId, descriptor);
					}),
				)
				.pipe(
					Effect.mapError((cause) =>
						errorFn(
							"create-version",
							`Project ${projectId} could not create a version.`,
							cause,
						),
					),
				);
		});

	const checkoutVersionFx: ProjectVersionRepositoryService["checkoutVersionFx"] = ({
		expectedFingerprint,
		projectId,
		versionId,
	}) =>
		Effect.gen(function* () {
			const nowMs = yield* Clock.currentTimeMillis;
			return yield* operations
				.withPermits(1)(
					Effect.gen(function* () {
						const current = yield* readCurrentSnapshotFx(projectId);
						const version = yield* readPublishedVersionFx(current.state, versionId);
						if (
							expectedFingerprint !== undefined &&
							expectedFingerprint !== current.contentFingerprint &&
							version.descriptor.contentFingerprint !== current.contentFingerprint
						)
							return yield* Effect.fail(
								errorFn(
									"checkout-version",
									"The Editor project changed after its checkout preview was read.",
								),
							);
						const snapshot = yield* providePlatformFx(
							readVersionSnapshotFx({
								manifest: version.manifest,
								root: current.state.paths.root,
							}),
						);
						if (snapshot.contentFingerprint !== version.descriptor.contentFingerprint)
							return yield* Effect.fail(
								errorFn(
									"checkout-version",
									`Version ${versionId} content does not match its descriptor.`,
								),
							);
						if (snapshot.arkpack !== version.descriptor.version)
							return yield* Effect.fail(
								errorFn(
									"checkout-version",
									`Version ${versionId} Arkpack version does not match its descriptor.`,
								),
							);
						if (snapshot.config.meta.id !== current.state.project.projectId)
							return yield* Effect.fail(
								errorFn(
									"checkout-version",
									`Version ${versionId} belongs to Editor project ${snapshot.config.meta.id}, not ${current.state.project.projectId}.`,
								),
							);
						const updatedAtMs = Math.max(nowMs, current.state.project.updatedAtMs + 1);
						const restoredScenarioFiles = snapshot.scenarios.map((scenario) =>
							BoardScenarioFileSchema.parse({
								...scenario,
								revision: updatedAtMs,
							}),
						);
						const restoredScenarios = restoredScenarioFiles.map((scenario) =>
							toScenarioFn(projectId, scenario),
						);
						const marker = GameProjectManifestSchema.parse({
							arkini: ArkiniAppVersion,
							revision: updatedAtMs,
						});
						const nextProject = cloneProjectFn({
							...current.state.project,
							title: snapshot.config.meta.title,
							version: snapshot.arkpack,
							updatedAtMs,
							revision: updatedAtMs,
							config: snapshot.config,
							resources: snapshot.resources,
						});
						const head = yield* readHeadFx(current.state);
						if (head === undefined)
							return yield* Effect.fail(
								errorFn(
									"checkout-version",
									"The Editor project has no published versions.",
								),
							);
						const nextHead = VersionHeadFileSchema.parse({
							...head,
							current: versionId,
						});

						yield* assertVersionDirectoryFx(current.state);
						yield* providePlatformFx(
							writeProjectFilesFx({
								root: current.state.paths.root,
								previous: {
									arkpack: current.state.project.version,
									marker: GameProjectManifestSchema.parse({
										arkini: ArkiniAppVersion,
										revision: current.state.project.revision,
									}),
									config: current.state.project.config,
									resources: current.state.project.resources,
								},
								next: {
									arkpack: nextProject.version,
									marker,
									config: nextProject.config,
									resources: nextProject.resources,
								},
								previousScenarioNames: current.state.scenarios.map(
									({ name }) => name,
								),
								scenarios: restoredScenarioFiles,
								versionHead: nextHead,
							}),
						);
						states.set(projectId, {
							...current.state,
							project: nextProject,
							scenarios: restoredScenarios,
							versionHistory: {
								...current.state.versionHistory,
								head: nextHead,
							},
						});
					}),
				)
				.pipe(
					Effect.mapError((cause) =>
						errorFn(
							"checkout-version",
							`Version ${versionId} could not be checked out.`,
							cause,
						),
					),
				);
		});

	const updateVersionTagFx: ProjectVersionRepositoryService["updateVersionTagFx"] = ({
		projectId,
		tag: tagCandidate,
		versionId,
	}) =>
		Effect.gen(function* () {
			const tag =
				tagCandidate === undefined
					? undefined
					: yield* Effect.try({
							try: () => ProjectVersionTagSchema.parse(tagCandidate),
							catch: (cause) =>
								errorFn(
									"update-version-tag",
									"The Editor version tag is invalid.",
									cause,
								),
						});
			return yield* operations
				.withPermits(1)(
					Effect.gen(function* () {
						const state = yield* readStateFx(projectId);
						const version = yield* readPublishedVersionFx(state, versionId);
						const descriptor = VersionDescriptorFileSchema.parse({
							...version.descriptor,
							arkini: ArkiniAppVersion,
							...(tag === undefined
								? {
										tag: undefined,
									}
								: {
										tag,
									}),
						});
						yield* withProjectLockFx(
							filesystemWrite,
							state.paths.root,
							Effect.gen(function* () {
								yield* assertVersionDirectoryFx(state);
								yield* writeJsonFx(
									state,
									yield* state.paths.versionDescriptorFileFx(versionId),
									descriptor,
								);
							}),
						);
						const versions = new Map(state.versionHistory.versions);
						versions.set(versionId, {
							...version,
							descriptor,
						});
						states.set(projectId, {
							...state,
							versionHistory: {
								...state.versionHistory,
								versions,
							},
						});
						return materializeDescriptorFn(projectId, versionId, descriptor);
					}),
				)
				.pipe(
					Effect.mapError((cause) =>
						errorFn(
							"update-version-tag",
							`Version ${versionId} could not update its tag.`,
							cause,
						),
					),
				);
		});

	const diffVersionsFx: ProjectVersionRepositoryService["diffVersionsFx"] = ({
		from,
		projectId,
		to,
	}) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const state = yield* readStateFx(projectId);
				return createProjectVersionDiffFn(
					from,
					to,
					yield* readDiffSnapshotFx(state, from),
					yield* readDiffSnapshotFx(state, to),
				);
			}).pipe(
				Effect.mapError((cause) =>
					errorFn(
						"diff-versions",
						`Versions for project ${projectId} could not be compared.`,
						cause,
					),
				),
			),
		);

	return {
		checkoutVersionFx,
		createVersionFx,
		diffVersionsFx,
		listVersionsFx,
		previewVersionCommitFx,
		readVersionStatusFx,
		updateVersionTagFx,
	} satisfies ProjectVersionRepositoryService;
});

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { Clock, FileSystem, Path } from "effect";
import { Effect, type Semaphore } from "effect";

import { ArkiniAppVersion } from "../../../../../shared/ArkiniAppMetadata";
import type { ProjectState } from "../ProjectState";
import type { Project } from "~/project-authoring/type/Project";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
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
import {
	ProjectVersionBodySchema,
	ProjectVersionSubjectSchema,
	ProjectVersionTagSchema,
} from "~/project-version/schema/ProjectVersionMetadataSchema";
import { createVersionReaderFx } from "./createVersionReaderFx";
import { createVersionSnapshotFx } from "./createVersionSnapshotFx";
import { assertProjectDirectoryFx } from "./assertProjectDirectoryFx";
import { readVersionSnapshotFx } from "./readVersionSnapshotFx";
import { withProjectLockFx } from "./withProjectLockFx";
import { writeProjectFilesFx } from "./writeProjectFilesFx";
import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";
import { withFilesystemWriteRecovery } from "~/filesystem-write/error/FilesystemWriteError";

type Operations = ProjectVersionRepositoryService;
type Operation = ProjectRepositoryError["operation"];
type DescriptorFile = VersionDescriptorFileSchema.Type;
const encoder = new TextEncoder();

const error = (operation: Operation, message: string, cause?: unknown) =>
	cause instanceof ProjectRepositoryError && cause.operation === operation
		? cause
		: new ProjectRepositoryError({
				operation,
				message: withFilesystemWriteRecovery(message, cause),
				cause,
			});

const cloneProject = (project: Project): Project => ({
	...project,
	resources: project.resources.map((resource) => ({
		...resource,
		bytes: resource.bytes.slice(),
	})),
});

const materializeDescriptor = (
	projectId: string,
	versionId: string,
	file: DescriptorFile,
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

const sameCommit = (
	file: DescriptorFile,
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

const toScenario = (
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
		readonly readState: (
			projectId: string,
		) => Effect.Effect<ProjectState, ProjectRepositoryError>;
		readonly states: Map<string, ProjectState>;
	}
}

/** Owns published full-snapshot history for filesystem Editor projects. */
export const createVersionOperationsFx = Effect.fn("createVersionOperationsFx")(function* ({
	filesystemWrite,
	operations,
	readState,
	states,
}: createVersionOperationsFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const pathService = yield* Path.Path;
	const providePlatform = <Value, Failure, Requirements>(
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
		providePlatform(
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
		readState,
	});

	const listVersionsFx: Operations["listVersionsFx"] = (projectId) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const state = yield* readState(projectId);
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
						materializeDescriptor(projectId, versionId, descriptor),
					);
			}).pipe(
				Effect.mapError((cause) =>
					error(
						"list-versions",
						`Versions for project ${projectId} could not be listed.`,
						cause,
					),
				),
			),
		);

	const readVersionStatusFx: Operations["readVersionStatusFx"] = (projectId) =>
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
					error(
						"read-version-status",
						`Version status for project ${projectId} could not be read.`,
						cause,
					),
				),
			),
		);

	const createVersionFx: Operations["createVersionFx"] = ({
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
					error("create-version", "The Editor version metadata is invalid.", cause),
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
								error(
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
							sameCommit(base, metadata, current.contentFingerprint)
						)
							return materializeDescriptor(projectId, head.current, base);
						if (base?.contentFingerprint === current.contentFingerprint)
							return yield* Effect.fail(
								error(
									"create-version",
									"The Editor project has no changes to commit.",
								),
							);

						const versionId = `v-${createHash("sha256")
							.update(
								JSON.stringify({
									parentVersionId: head?.current,
									contentFingerprint: current.contentFingerprint,
									...metadata,
								}),
							)
							.digest("hex")}`;
						const latestCreatedAt =
							head === undefined
								? undefined
								: Math.max(
										...(yield* Effect.forEach(head.versions, (id) =>
											readDescriptorFx(current.state, id).pipe(
												Effect.map((descriptor) => descriptor.createdAtMs),
											),
										)),
									);
						const descriptor = VersionDescriptorFileSchema.parse({
							...(head === undefined
								? {}
								: {
										parentVersionId: head.current,
									}),
							...metadata,
							arkini: ArkiniAppVersion,
							version: current.state.project.version,
							sourceRevision: current.state.project.revision,
							contentFingerprint: current.contentFingerprint,
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
								const snapshot = yield* providePlatform(
									createVersionSnapshotFx({
										arkpack: current.state.project.version,
										config: current.state.project.config,
										filesystemWrite,
										resources: current.state.project.resources,
										scenarios: current.state.scenarios,
										paths: current.state.paths,
									}),
								);
								if (snapshot.contentFingerprint !== current.contentFingerprint)
									return yield* Effect.fail(
										new Error(
											"The Editor version snapshot changed while it was prepared.",
										),
									);
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
									yield* current.state.paths.versionDescriptorFileFx(versionId),
									descriptor,
								);
								yield* writeJsonFx(
									current.state,
									current.state.paths.versionHeadFile,
									nextHead,
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
							versionHistory: {
								head: nextHead,
								versions,
							},
						});
						return materializeDescriptor(projectId, versionId, descriptor);
					}),
				)
				.pipe(
					Effect.mapError((cause) =>
						error(
							"create-version",
							`Project ${projectId} could not create a version.`,
							cause,
						),
					),
				);
		});

	const checkoutVersionFx: Operations["checkoutVersionFx"] = ({
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
								error(
									"checkout-version",
									"The Editor project changed after its checkout preview was read.",
								),
							);
						const snapshot = yield* providePlatform(
							readVersionSnapshotFx({
								manifest: version.manifest,
								paths: current.state.paths,
							}),
						);
						if (snapshot.contentFingerprint !== version.descriptor.contentFingerprint)
							return yield* Effect.fail(
								error(
									"checkout-version",
									`Version ${versionId} content does not match its descriptor.`,
								),
							);
						if (snapshot.arkpack !== version.descriptor.version)
							return yield* Effect.fail(
								error(
									"checkout-version",
									`Version ${versionId} Arkpack version does not match its descriptor.`,
								),
							);
						if (snapshot.config.meta.id !== current.state.project.projectId)
							return yield* Effect.fail(
								error(
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
							toScenario(projectId, scenario),
						);
						const marker = GameProjectManifestSchema.parse({
							arkini: ArkiniAppVersion,
							revision: updatedAtMs,
						});
						const nextProject = cloneProject({
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
								error(
									"checkout-version",
									"The Editor project has no published versions.",
								),
							);
						const nextHead = VersionHeadFileSchema.parse({
							...head,
							current: versionId,
						});

						yield* assertVersionDirectoryFx(current.state);
						yield* providePlatform(
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
						error(
							"checkout-version",
							`Version ${versionId} could not be checked out.`,
							cause,
						),
					),
				);
		});

	const updateVersionTagFx: Operations["updateVersionTagFx"] = ({
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
								error(
									"update-version-tag",
									"The Editor version tag is invalid.",
									cause,
								),
						});
			return yield* operations
				.withPermits(1)(
					Effect.gen(function* () {
						const state = yield* readState(projectId);
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
						return materializeDescriptor(projectId, versionId, descriptor);
					}),
				)
				.pipe(
					Effect.mapError((cause) =>
						error(
							"update-version-tag",
							`Version ${versionId} could not update its tag.`,
							cause,
						),
					),
				);
		});

	const diffVersionsFx: Operations["diffVersionsFx"] = ({ from, projectId, to }) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const state = yield* readState(projectId);
				return createProjectVersionDiffFn(
					from,
					to,
					yield* readDiffSnapshotFx(state, from),
					yield* readDiffSnapshotFx(state, to),
				);
			}).pipe(
				Effect.mapError((cause) =>
					error(
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
		readVersionStatusFx,
		updateVersionTagFx,
	} satisfies Operations;
});

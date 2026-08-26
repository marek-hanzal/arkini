import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { Clock, FileSystem, Path } from "effect";
import { Effect, type Semaphore } from "effect";

import { ArkiniAppVersion } from "../../../../../shared/ArkiniAppMetadata";
import type { FilesystemEditorProjectState } from "../FilesystemEditorProjectState";
import type { EditorProject } from "~/editor/EditorProject";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import type { EditorBoardScenarioSchema } from "~/editor/board/EditorBoardScenarioSchema";
import { EditorBoardScenarioFileSchema } from "~/editor/filesystem/EditorBoardScenarioFileSchema";
import { EditorProjectFileSchema } from "~/editor/filesystem/EditorProjectFileSchema";
import { EditorVersionDescriptorFileSchema } from "~/editor/filesystem/EditorVersionDescriptorFileSchema";
import { EditorVersionHeadFileSchema } from "~/editor/filesystem/EditorVersionHeadFileSchema";
import type {
	EditorProjectVersionDescriptor,
	EditorProjectVersionRepositoryService,
} from "~/editor/version/EditorProjectVersion";
import { createEditorProjectVersionDiff } from "~/editor/version/createEditorProjectVersionDiff";
import {
	EditorProjectSnapshotFormatVersion,
	EditorProjectVersionBodySchema,
	EditorProjectVersionSubjectSchema,
	EditorProjectVersionTagSchema,
} from "~/editor/version/EditorProjectVersionMetadataSchema";
import { readEditorProjectVersionApplicability } from "~/editor/version/readEditorProjectVersionApplicabilityFx";
import { createFilesystemEditorProjectVersionReaderFx } from "./createFilesystemEditorProjectVersionReaderFx";
import { createFilesystemEditorVersionSnapshotFx } from "./createFilesystemEditorVersionSnapshotFx";
import { assertFilesystemEditorProjectDirectoryFx } from "./assertFilesystemEditorProjectDirectoryFx";
import { readFilesystemEditorVersionSnapshotFx } from "./readFilesystemEditorVersionSnapshotFx";
import { replaceFilesystemEditorJsonFx } from "./replaceFilesystemEditorJsonFx";
import { withFilesystemEditorProjectLockFx } from "./withFilesystemEditorProjectLockFx";
import { writeFilesystemEditorProjectFilesFx } from "./writeFilesystemEditorProjectFilesFx";

type Operations = EditorProjectVersionRepositoryService;
type Operation = EditorProjectRepositoryError["operation"];
type DescriptorFile = EditorVersionDescriptorFileSchema.Type;

const error = (operation: Operation, message: string, cause?: unknown) =>
	cause instanceof EditorProjectRepositoryError && cause.operation === operation
		? cause
		: new EditorProjectRepositoryError({
				operation,
				message,
				cause,
			});

const cloneProject = (project: EditorProject): EditorProject => ({
	...project,
	resources: project.resources.map((resource) => ({
		...resource,
		bytes: resource.bytes.slice(),
	})),
});

const materializeDescriptor = (
	projectId: string,
	file: DescriptorFile,
): EditorProjectVersionDescriptor => ({
	applicability: readEditorProjectVersionApplicability(file.arkini),
	arkini: file.arkini,
	arkpackVersion: file.arkpackVersion,
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
	snapshotFormatVersion: file.snapshotFormatVersion,
	sourceRevision: file.sourceRevision,
	subject: file.subject,
	...(file.tag === undefined
		? {}
		: {
				tag: file.tag,
			}),
	versionId: file.versionId,
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
	file: EditorBoardScenarioFileSchema.Type,
): EditorBoardScenarioSchema.Type => ({
	projectId,
	name: file.name,
	projectRevision: file.projectRevision,
	version: file.arkpackVersion,
	bytes: Uint8Array.from(Buffer.from(file.bytesBase64, "base64")),
	createdAtMs: file.createdAtMs,
	updatedAtMs: file.updatedAtMs,
});

export namespace createFilesystemEditorProjectVersionOperationsFx {
	export interface Props {
		readonly operations: Semaphore.Semaphore;
		readonly readState: (
			projectId: string,
		) => Effect.Effect<FilesystemEditorProjectState, EditorProjectRepositoryError>;
		readonly states: Map<string, FilesystemEditorProjectState>;
	}
}

/** Owns published full-snapshot history for filesystem Editor projects. */
export const createFilesystemEditorProjectVersionOperationsFx = Effect.fn(
	"createFilesystemEditorProjectVersionOperationsFx",
)(function* ({
	operations,
	readState,
	states,
}: createFilesystemEditorProjectVersionOperationsFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const pathService = yield* Path.Path;
	const providePlatform = <Value, Failure, Requirements>(
		effect: Effect.Effect<Value, Failure, Requirements>,
	) =>
		effect.pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, pathService),
		);
	const replaceJsonFx = (target: string, value: unknown) =>
		providePlatform(replaceFilesystemEditorJsonFx(target, value));
	const assertVersionDirectoryFx = (state: FilesystemEditorProjectState) =>
		providePlatform(
			Effect.gen(function* () {
				yield* fileSystem.makeDirectory(state.paths.versions, {
					recursive: true,
				});
				yield* assertFilesystemEditorProjectDirectoryFx({
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
	} = yield* createFilesystemEditorProjectVersionReaderFx({
		readState,
	});

	const listVersionsFx: Operations["listVersionsFx"] = (projectId) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const state = yield* readState(projectId);
				const head = yield* readHeadFx(state);
				if (head === undefined) return [];
				const descriptors = yield* Effect.forEach(head.versionIds, (versionId) =>
					readDescriptorFx(state, versionId),
				);
				return descriptors
					.sort(
						(left, right) =>
							right.createdAtMs - left.createdAtMs ||
							left.versionId.localeCompare(right.versionId),
					)
					.map((descriptor) => materializeDescriptor(projectId, descriptor));
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
						: yield* readDescriptorFx(current.state, head.versionId);
				const dirty = base?.contentFingerprint !== current.contentFingerprint;
				return {
					canCommit: dirty,
					...(head === undefined
						? {}
						: {
								currentBaseVersionId: head.versionId,
							}),
					currentFingerprint: current.contentFingerprint,
					dirty,
					versionCount: head?.versionIds.length ?? 0,
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
					subject: EditorProjectVersionSubjectSchema.parse(subjectCandidate),
					...(bodyCandidate === undefined
						? {}
						: {
								body: EditorProjectVersionBodySchema.parse(bodyCandidate),
							}),
					...(tagCandidate === undefined
						? {}
						: {
								tag: EditorProjectVersionTagSchema.parse(tagCandidate),
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
								: yield* readDescriptorFx(current.state, head.versionId);
						if (
							base !== undefined &&
							sameCommit(base, metadata, current.contentFingerprint)
						)
							return materializeDescriptor(projectId, base);
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
									parentVersionId: head?.versionId,
									contentFingerprint: current.contentFingerprint,
									...metadata,
								}),
							)
							.digest("hex")}`;
						const latestCreatedAt =
							head === undefined
								? undefined
								: Math.max(
										...(yield* Effect.forEach(head.versionIds, (id) =>
											readDescriptorFx(current.state, id).pipe(
												Effect.map((descriptor) => descriptor.createdAtMs),
											),
										)),
									);
						const descriptor = EditorVersionDescriptorFileSchema.parse({
							versionId,
							...(head === undefined
								? {}
								: {
										parentVersionId: head.versionId,
									}),
							...metadata,
							arkini: ArkiniAppVersion,
							arkpackVersion: current.state.project.version,
							sourceRevision: current.state.project.revision,
							snapshotFormatVersion: EditorProjectSnapshotFormatVersion,
							contentFingerprint: current.contentFingerprint,
							createdAtMs:
								latestCreatedAt === undefined
									? clockMs
									: Math.max(clockMs, latestCreatedAt + 1),
						});
						const nextHead = EditorVersionHeadFileSchema.parse({
							versionId,
							versionIds: [
								...(head?.versionIds ?? []),
								...(head?.versionIds.includes(versionId)
									? []
									: [
											versionId,
										]),
							],
						});

						const snapshot = yield* withFilesystemEditorProjectLockFx(
							current.state.paths.root,
							Effect.gen(function* () {
								yield* assertVersionDirectoryFx(current.state);
								const snapshot = yield* providePlatform(
									createFilesystemEditorVersionSnapshotFx({
										config: current.state.project.config,
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
								yield* replaceJsonFx(
									yield* current.state.paths.versionManifestFileFx(versionId),
									snapshot.manifest,
								);
								yield* replaceJsonFx(
									yield* current.state.paths.versionDescriptorFileFx(versionId),
									descriptor,
								);
								yield* replaceJsonFx(current.state.paths.versionHeadFile, nextHead);
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
						return materializeDescriptor(projectId, descriptor);
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
						const applicability = readEditorProjectVersionApplicability(
							version.descriptor.arkini,
						);
						if (applicability.type === "incompatible")
							return yield* Effect.fail(
								error("checkout-version", applicability.reason),
							);
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
							readFilesystemEditorVersionSnapshotFx({
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
						const updatedAtMs = Math.max(nowMs, current.state.project.updatedAtMs + 1);
						const restoredScenarioFiles = snapshot.scenarios.map((scenario) =>
							EditorBoardScenarioFileSchema.parse({
								...scenario,
								projectRevision: updatedAtMs,
							}),
						);
						const restoredScenarios = restoredScenarioFiles.map((scenario) =>
							toScenario(projectId, scenario),
						);
						const marker = EditorProjectFileSchema.parse({
							format: "arkini-editor",
							formatVersion: 1,
							arkpackVersion: version.descriptor.arkpackVersion,
							updatedAtMs,
						});
						const nextProject = cloneProject({
							...current.state.project,
							title: snapshot.config.meta.title,
							version: version.descriptor.arkpackVersion,
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
						const nextHead = EditorVersionHeadFileSchema.parse({
							...head,
							versionId,
						});

						yield* withFilesystemEditorProjectLockFx(
							current.state.paths.root,
							Effect.gen(function* () {
								yield* assertVersionDirectoryFx(current.state);
								yield* fileSystem.makeDirectory(current.state.paths.scenarios, {
									recursive: true,
								});
								for (const scenario of restoredScenarioFiles) {
									yield* replaceJsonFx(
										yield* current.state.paths.scenarioFileFx(scenario.name),
										scenario,
									);
								}
								const restoredNames = new Set(
									restoredScenarioFiles.map((scenario) => scenario.name),
								);
								for (const scenario of current.state.scenarios) {
									if (restoredNames.has(scenario.name)) continue;
									yield* fileSystem.remove(
										yield* current.state.paths.scenarioFileFx(scenario.name),
										{
											force: true,
										},
									);
								}
								yield* providePlatform(
									writeFilesystemEditorProjectFilesFx({
										root: current.state.paths.root,
										previous: {
											marker: EditorProjectFileSchema.parse({
												format: "arkini-editor",
												formatVersion: 1,
												arkpackVersion: current.state.project.version,
												updatedAtMs: current.state.project.updatedAtMs,
											}),
											config: current.state.project.config,
											resources: current.state.project.resources,
										},
										next: {
											marker,
											config: nextProject.config,
											resources: nextProject.resources,
										},
									}),
								);
								yield* replaceJsonFx(current.state.paths.versionHeadFile, nextHead);
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
							try: () => EditorProjectVersionTagSchema.parse(tagCandidate),
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
						const applicability = readEditorProjectVersionApplicability(
							version.descriptor.arkini,
						);
						if (applicability.type === "incompatible")
							return yield* Effect.fail(
								error("update-version-tag", applicability.reason),
							);
						const descriptor = EditorVersionDescriptorFileSchema.parse({
							...version.descriptor,
							...(tag === undefined
								? {
										tag: undefined,
									}
								: {
										tag,
									}),
						});
						yield* withFilesystemEditorProjectLockFx(
							state.paths.root,
							Effect.gen(function* () {
								yield* assertVersionDirectoryFx(state);
								yield* replaceJsonFx(
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
						return materializeDescriptor(projectId, descriptor);
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
				return createEditorProjectVersionDiff(
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

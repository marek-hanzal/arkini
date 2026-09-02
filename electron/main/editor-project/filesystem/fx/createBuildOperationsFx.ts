import { basename, isAbsolute, relative } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { FileSystem, Path } from "effect";
import { Data, Effect, type Semaphore } from "effect";

import { ArkpackLimits } from "~shared/ArkpackLimits";
import type { ProjectState } from "../ProjectState";
import type { EditorBuildRepositoryService } from "~/editor-build/service/EditorBuildRepository";
import {
	EditorProjectBuildContentSchema,
	EditorProjectBuildSchema,
} from "~/editor-build/schema/EditorProjectBuildSchema";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { packDirectoryFx } from "~/arkpack-artifact/fx/packDirectoryFx";
import { readArkpackContentHashFx } from "~/arkpack-artifact/fx/readArkpackContentHashFx";
import { GameValidationError } from "~/game-config-diagnostic/error/GameValidationError";
import { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import { readArkpackArtifactNameFn } from "~/arkpack-artifact/fn/readArkpackArtifactNameFn";
import { withProjectLockFx } from "./withProjectLockFx";
import { readProjectFilesFx } from "./readProjectFilesFx";
import { ensureProjectGitignoreFx } from "./ensureProjectGitignoreFx";
import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";
import { FilesystemWriteError } from "~/filesystem-write/error/FilesystemWriteError";
import { isFilesystemPathSafeFx } from "~/filesystem-write/fx/isFilesystemPathSafeFx";
import { createVersionReaderFx } from "./createVersionReaderFx";

class EditorProjectBuildOperationError extends Data.TaggedError(
	"EditorProjectBuildOperationError",
)<{
	readonly message: string;
}> {}

const projectChangedBeforeBuildFn = () =>
	new EditorProjectBuildOperationError({
		message:
			"The saved project changed before the build snapshot could be published. Refresh the project and build again.",
	});

const relativeDiagnosticSourceFn = (projectRoot: string, source: string) => {
	if (!isAbsolute(source)) return source;
	const projectRelative = relative(projectRoot, source);
	return projectRelative.startsWith("..") || isAbsolute(projectRelative)
		? basename(source)
		: projectRelative.replaceAll("\\", "/");
};

const relativeDiagnosticProvenanceFn = (
	projectRoot: string,
	candidate: unknown,
	key?: string,
): unknown => {
	if (typeof candidate === "string" && (key === "source" || key === "sources"))
		return relativeDiagnosticSourceFn(projectRoot, candidate);
	if (Array.isArray(candidate))
		return candidate.map((value) => relativeDiagnosticProvenanceFn(projectRoot, value, key));
	if (typeof candidate !== "object" || candidate === null) return candidate;
	return Object.fromEntries(
		Object.entries(candidate).map(([entryKey, value]) => [
			entryKey,
			relativeDiagnosticProvenanceFn(projectRoot, value, entryKey),
		]),
	);
};

const filesystemFailureMessageFn = (
	operation: "build-project" | "read-project-build",
	cause: FilesystemWriteError,
) => {
	const action = operation === "build-project" ? "published" : "read";
	return cause.recovery === undefined
		? `The Editor build could not be ${action} safely. Retry the operation.`
		: `The Editor build could not be ${action} safely. Recovery data was preserved; restart the Editor before retrying.`;
};

const createBuildErrorFn = (
	operation: "build-project" | "read-project-build",
	message: string,
	cause?: unknown,
) =>
	cause instanceof ProjectRepositoryError && cause.operation === operation
		? cause
		: new ProjectRepositoryError({
				operation,
				message:
					cause instanceof EditorProjectBuildOperationError
						? cause.message
						: cause instanceof FilesystemWriteError
							? filesystemFailureMessageFn(operation, cause)
							: message,
				...(cause instanceof GameValidationError
					? {
							diagnostics: cause.diagnostics,
						}
					: {}),
				cause,
			});

const assertRevisionFx = (
	state: ProjectState,
	expectedRevision: number,
	operation: "build-project" | "read-project-build",
) =>
	state.project.revision === expectedRevision
		? Effect.void
		: Effect.fail(
				createBuildErrorFn(
					operation,
					`Editor project ${state.project.projectId} changed from revision ${expectedRevision} to ${state.project.revision}.`,
				),
			);

export namespace createBuildOperationsFx {
	export interface Props {
		readonly filesystemWrite: FilesystemWrite;
		readonly operations: Semaphore.Semaphore;
		readonly readStateFx: (
			projectId: string,
		) => Effect.Effect<ProjectState, ProjectRepositoryError, never>;
	}
}

/** Publishes and reads the one canonical artifact for an exact Editor project revision. */
export const createBuildOperationsFx = Effect.fn("createBuildOperationsFx")(function* ({
	filesystemWrite,
	operations,
	readStateFx,
}: createBuildOperationsFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const providePlatformFx = <Value, Failure, Requirements>(
		effect: Effect.Effect<Value, Failure, Requirements>,
	) =>
		effect.pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, path),
		);
	const { readCurrentSnapshotFx, readDescriptorFx, readHeadFx } = yield* createVersionReaderFx({
		readStateFx,
	});
	const assertCommittedHeadFx = Effect.fn("assertProjectCommittedHeadFx")(function* (
		state: ProjectState,
	) {
		const head = yield* readHeadFx(state);
		if (head === undefined)
			return yield* Effect.fail(
				new EditorProjectBuildOperationError({
					message: "Commit the initial project version before building.",
				}),
			);
		const current = yield* readCurrentSnapshotFx(state.project.projectId);
		const descriptor = yield* readDescriptorFx(state, head.current);
		if (descriptor.contentFingerprint !== current.contentFingerprint)
			return yield* Effect.fail(
				new EditorProjectBuildOperationError({
					message: "Commit the saved project changes before building.",
				}),
			);
	});

	const buildProjectFx: EditorBuildRepositoryService["buildProjectFx"] = ({
		expectedRevision,
		projectId,
	}) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const state = yield* readStateFx(projectId);
				yield* assertRevisionFx(state, expectedRevision, "build-project");
				yield* assertCommittedHeadFx(state);
				const build = yield* providePlatformFx(
					withProjectLockFx(
						filesystemWrite,
						state.paths.root,
						Effect.gen(function* () {
							yield* ensureProjectGitignoreFx(state.paths);
							const assertCurrentFx = readProjectFilesFx(state.paths.root).pipe(
								Effect.mapError(projectChangedBeforeBuildFn),
								Effect.filterOrFail(
									(files) =>
										files.marker.revision === state.project.revision &&
										files.arkpack === state.project.version &&
										isDeepStrictEqual(files.config, state.project.config) &&
										isDeepStrictEqual(files.resources, state.project.resources),
									projectChangedBeforeBuildFn,
								),
								Effect.asVoid,
							);
							yield* assertCurrentFx;
							return yield* packDirectoryFx({
								input: state.paths.root,
								assertCurrentFx,
							}).pipe(
								Effect.mapError((cause) =>
									cause instanceof GameValidationError
										? new GameValidationError({
												diagnostics: GameDiagnosticsSchema.parse(
													cause.diagnostics.map((diagnostic) =>
														relativeDiagnosticProvenanceFn(
															state.paths.root,
															diagnostic,
														),
													),
												),
											})
										: cause,
								),
							);
						}),
					),
				);
				if (build.packageId !== projectId)
					return yield* Effect.fail(
						new EditorProjectBuildOperationError({
							message: `The built package identity ${build.packageId} does not match Editor project ${projectId}.`,
						}),
					);
				return EditorProjectBuildSchema.parse({
					projectId,
					revision: state.project.revision,
					contentHash: build.contentHash,
					size: build.bytes,
					diagnostics: GameDiagnosticsSchema.parse(
						build.diagnostics.map((diagnostic) =>
							relativeDiagnosticProvenanceFn(state.paths.root, diagnostic),
						),
					),
				});
			}).pipe(
				Effect.mapError((cause) =>
					createBuildErrorFn(
						"build-project",
						`Editor project ${projectId} could not be built.`,
						cause,
					),
				),
			),
		);

	const readProjectBuildFx: EditorBuildRepositoryService["readProjectBuildFx"] = ({
		contentHash,
		expectedRevision,
		projectId,
	}) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const state = yield* readStateFx(projectId);
				yield* assertRevisionFx(state, expectedRevision, "read-project-build");
				return yield* withProjectLockFx(
					filesystemWrite,
					state.paths.root,
					Effect.gen(function* () {
						const build = state.paths.build;
						if (!(yield* fileSystem.exists(build)))
							return yield* Effect.fail(new Error("No Editor project build exists."));
						if (!(yield* isFilesystemPathSafeFx(fileSystem, state.paths.root, build)))
							return yield* Effect.fail(
								new Error(`Project build directory ${build} is a symbolic link.`),
							);
						const arkpackPath = path.join(build, readArkpackArtifactNameFn(projectId));
						if (
							!(yield* isFilesystemPathSafeFx(
								fileSystem,
								state.paths.root,
								arkpackPath,
							))
						)
							return yield* Effect.fail(
								new Error("The Editor build Arkpack is a symbolic link."),
							);
						const info = yield* fileSystem.stat(arkpackPath);
						if (info.size > ArkpackLimits.maxArkpackBytes)
							return yield* Effect.fail(
								new Error(
									`Arkpack exceeds the ${ArkpackLimits.maxArkpackBytes} byte limit.`,
								),
							);
						const bytes = Uint8Array.from(yield* fileSystem.readFile(arkpackPath));
						if ((yield* readArkpackContentHashFx(bytes)) !== contentHash)
							return yield* Effect.fail(
								new Error(
									"The current Editor build does not match the requested artifact.",
								),
							);
						return EditorProjectBuildContentSchema.parse({
							bytes,
						});
					}),
				);
			}).pipe(
				Effect.mapError((cause) =>
					createBuildErrorFn(
						"read-project-build",
						`Editor project ${projectId} build could not be read.`,
						cause,
					),
				),
			),
		);

	return {
		buildProjectFx,
		readProjectBuildFx,
	};
});

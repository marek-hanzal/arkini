import { basename, isAbsolute, relative } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { FileSystem, Path } from "effect";
import { Data, Effect, type Semaphore } from "effect";

import { ArkpackLimits } from "../../../../../shared/ArkpackLimits";
import type { ProjectState } from "../ProjectState";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import {
	EditorProjectBuildContentSchema,
	EditorProjectBuildSchema,
} from "~/editor/EditorProjectBuildSchema";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import { readArkpackContentHashFx } from "~/engine/pack/fx/readArkpackContentHashFx";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";
import { withProjectLockFx } from "./withProjectLockFx";
import { readProjectFilesFx } from "./readProjectFilesFx";
import { ensureProjectGitignoreFx } from "./ensureProjectGitignoreFx";
import type { FilesystemWrite } from "~/engine/filesystem/FilesystemWrite";
import { FilesystemWriteError } from "~/engine/filesystem/FilesystemWriteError";
import { isFilesystemPathSafeFx } from "~/engine/filesystem/isFilesystemPathSafeFx";

type Operations = Pick<EditorProjectRepositoryService, "buildProjectFx" | "readProjectBuildFx">;

class EditorProjectBuildOperationError extends Data.TaggedError(
	"EditorProjectBuildOperationError",
)<{
	readonly message: string;
}> {}

const projectChangedBeforeBuild = () =>
	new EditorProjectBuildOperationError({
		message:
			"The saved project changed before the build snapshot could be published. Refresh the project and build again.",
	});

const relativeDiagnosticSource = (projectRoot: string, source: string) => {
	if (!isAbsolute(source)) return source;
	const projectRelative = relative(projectRoot, source);
	return projectRelative.startsWith("..") || isAbsolute(projectRelative)
		? basename(source)
		: projectRelative.replaceAll("\\", "/");
};

const relativeDiagnosticProvenance = (
	projectRoot: string,
	candidate: unknown,
	key?: string,
): unknown => {
	if (typeof candidate === "string" && (key === "source" || key === "sources"))
		return relativeDiagnosticSource(projectRoot, candidate);
	if (Array.isArray(candidate))
		return candidate.map((value) => relativeDiagnosticProvenance(projectRoot, value, key));
	if (typeof candidate !== "object" || candidate === null) return candidate;
	return Object.fromEntries(
		Object.entries(candidate).map(([entryKey, value]) => [
			entryKey,
			relativeDiagnosticProvenance(projectRoot, value, entryKey),
		]),
	);
};

const safeBuildDiagnostics = (projectRoot: string, diagnostics: GameDiagnosticsSchema.Type) =>
	GameDiagnosticsSchema.parse(
		diagnostics.map((diagnostic) => relativeDiagnosticProvenance(projectRoot, diagnostic)),
	);

const filesystemFailureMessage = (
	operation: "build-project" | "read-project-build",
	cause: FilesystemWriteError,
) => {
	const action = operation === "build-project" ? "published" : "read";
	return cause.recovery === undefined
		? `The Editor build could not be ${action} safely. Retry the operation.`
		: `The Editor build could not be ${action} safely. Recovery data was preserved; restart the Editor before retrying.`;
};

const error = (
	operation: "build-project" | "read-project-build",
	message: string,
	cause?: unknown,
) =>
	cause instanceof EditorProjectRepositoryError && cause.operation === operation
		? cause
		: new EditorProjectRepositoryError({
				operation,
				message:
					cause instanceof EditorProjectBuildOperationError
						? cause.message
						: cause instanceof FilesystemWriteError
							? filesystemFailureMessage(operation, cause)
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
				error(
					operation,
					`Editor project ${state.project.projectId} changed from revision ${expectedRevision} to ${state.project.revision}.`,
				),
			);

export namespace createBuildOperationsFx {
	export interface Props {
		readonly filesystemWrite: FilesystemWrite;
		readonly operations: Semaphore.Semaphore;
		readonly readState: (
			projectId: string,
		) => Effect.Effect<ProjectState, EditorProjectRepositoryError>;
	}
}

/** Publishes and reads the one canonical artifact for an exact Editor project revision. */
export const createBuildOperationsFx = Effect.fn("createBuildOperationsFx")(function* ({
	filesystemWrite,
	operations,
	readState,
}: createBuildOperationsFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const providePlatform = <Value, Failure, Requirements>(
		effect: Effect.Effect<Value, Failure, Requirements>,
	) =>
		effect.pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, path),
		);

	const buildProjectFx: Operations["buildProjectFx"] = ({ expectedRevision, projectId }) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const state = yield* readState(projectId);
				yield* assertRevisionFx(state, expectedRevision, "build-project");
				yield* providePlatform(
					withProjectLockFx(
						filesystemWrite,
						state.paths.root,
						ensureProjectGitignoreFx(state.paths),
					),
				);
				const assertCurrentFx = readProjectFilesFx(state.paths.root).pipe(
					Effect.mapError(projectChangedBeforeBuild),
					Effect.filterOrFail(
						(files) =>
							files.marker.revision === state.project.revision &&
							files.arkpack === state.project.version &&
							isDeepStrictEqual(files.config, state.project.config) &&
							isDeepStrictEqual(files.resources, state.project.resources),
						projectChangedBeforeBuild,
					),
					Effect.asVoid,
				);
				yield* providePlatform(assertCurrentFx);
				const build = yield* providePlatform(
					packDirectoryFx({
						input: state.paths.root,
						assertCurrentFx,
					}).pipe(
						Effect.mapError((cause) =>
							cause instanceof GameValidationError
								? new GameValidationError({
										diagnostics: safeBuildDiagnostics(
											state.paths.root,
											cause.diagnostics,
										),
									})
								: cause,
						),
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
					diagnostics: safeBuildDiagnostics(state.paths.root, build.diagnostics),
				});
			}).pipe(
				Effect.mapError((cause) =>
					error(
						"build-project",
						`Editor project ${projectId} could not be built.`,
						cause,
					),
				),
			),
		);

	const readProjectBuildFx: Operations["readProjectBuildFx"] = ({
		contentHash,
		expectedRevision,
		projectId,
	}) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const state = yield* readState(projectId);
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
						const stem = encodeGameProjectFileStem(projectId);
						const arkpackPath = path.join(build, `${stem}.arkpack`);
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
					error(
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

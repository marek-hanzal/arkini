import { isDeepStrictEqual } from "node:util";
import { FileSystem, Path } from "effect";
import { Effect, type Semaphore } from "effect";

import { ArkpackLimits } from "../../../../../shared/ArkpackLimits";
import type { FilesystemEditorProjectState } from "../FilesystemEditorProjectState";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import {
	EditorProjectBuildContentSchema,
	EditorProjectBuildSchema,
} from "~/editor/EditorProjectBuildSchema";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { ArkiniBuiltPublicKey } from "~/engine/pack/ArkiniBuiltPublicKey";
import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import { readArkpackContentHashFx } from "~/engine/pack/fx/readArkpackContentHashFx";
import { ArkpackSignatureSchema } from "~/engine/pack/schema/ArkpackSignatureSchema";
import { verifyArkpackTrustFx } from "~/engine/pack/fx/verifyArkpackTrustFx";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";
import { withFilesystemEditorProjectLockFx } from "./withFilesystemEditorProjectLockFx";
import { readFilesystemEditorProjectFilesFx } from "./readFilesystemEditorProjectFilesFx";

type Operations = Pick<EditorProjectRepositoryService, "buildProjectFx" | "readProjectBuildFx">;

const error = (
	operation: "build-project" | "read-project-build",
	message: string,
	cause?: unknown,
) =>
	cause instanceof EditorProjectRepositoryError && cause.operation === operation
		? cause
		: new EditorProjectRepositoryError({
				operation,
				message,
				...(cause instanceof GameValidationError
					? {
							diagnostics: cause.diagnostics,
						}
					: {}),
				cause,
			});

const assertRevisionFx = (
	state: FilesystemEditorProjectState,
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

export namespace createFilesystemEditorProjectBuildOperationsFx {
	export interface Props {
		readonly operations: Semaphore.Semaphore;
		readonly readState: (
			projectId: string,
		) => Effect.Effect<FilesystemEditorProjectState, EditorProjectRepositoryError>;
	}
}

/** Publishes and reads the one canonical artifact for an exact Editor project revision. */
export const createFilesystemEditorProjectBuildOperationsFx = Effect.fn(
	"createFilesystemEditorProjectBuildOperationsFx",
)(function* ({ operations, readState }: createFilesystemEditorProjectBuildOperationsFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const providePlatform = <Value, Failure, Requirements>(
		effect: Effect.Effect<Value, Failure, Requirements>,
	) =>
		effect.pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, path),
		);

	const buildProjectFx: Operations["buildProjectFx"] = ({
		expectedRevision,
		projectId,
		signKey,
	}) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const state = yield* readState(projectId);
				yield* assertRevisionFx(state, expectedRevision, "build-project");
				if (signKey !== undefined && ArkiniBuiltPublicKey === undefined)
					return yield* Effect.fail(
						new Error("This Arkini build does not contain a public signing key."),
					);
				const assertCurrentFx = readFilesystemEditorProjectFilesFx(state.paths.root).pipe(
					Effect.filterOrFail(
						(files) =>
							files.marker.revision === state.project.revision &&
							files.arkpack === state.project.version &&
							isDeepStrictEqual(files.config, state.project.config) &&
							isDeepStrictEqual(files.resources, state.project.resources),
						() =>
							new Error(
								"Editor project files changed outside the Editor. Refresh before building.",
							),
					),
					Effect.asVoid,
				);
				const build = yield* providePlatform(
					packDirectoryFx({
						input: state.paths.root,
						assertCurrentFx,
						...(signKey === undefined || ArkiniBuiltPublicKey === undefined
							? {}
							: {
									signing: {
										publicKey: ArkiniBuiltPublicKey,
										signKey,
									},
								}),
					}),
				);
				if (build.packageId !== projectId)
					return yield* Effect.fail(
						new Error(
							`Built package ${build.packageId} does not match Editor project ${projectId}.`,
						),
					);
				return EditorProjectBuildSchema.parse({
					projectId,
					revision: state.project.revision,
					contentHash: build.contentHash,
					signed: build.signature !== undefined,
					size: build.bytes,
					diagnostics: build.diagnostics,
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
		signed,
	}) =>
		operations.withPermits(1)(
			Effect.gen(function* () {
				const state = yield* readState(projectId);
				yield* assertRevisionFx(state, expectedRevision, "read-project-build");
				return yield* withFilesystemEditorProjectLockFx(
					state.paths.root,
					Effect.gen(function* () {
						const build = state.paths.build;
						if (!(yield* fileSystem.exists(build)))
							return yield* Effect.fail(new Error("No Editor project build exists."));
						const canonicalBuild = yield* fileSystem.realPath(build);
						if (canonicalBuild !== build)
							return yield* Effect.fail(
								new Error(`Project build directory ${build} is a symbolic link.`),
							);
						const stem = encodeGameProjectFileStem(projectId);
						const arkpackPath = path.join(build, `${stem}.arkpack`);
						if ((yield* fileSystem.realPath(arkpackPath)) !== arkpackPath)
							return yield* Effect.fail(
								new Error("The Editor build Arkpack is a symbolic link."),
							);
						const info = yield* fileSystem.stat(arkpackPath);
						if (info.size > ArkpackLimits.maxCompressedBytes)
							return yield* Effect.fail(
								new Error(
									`Arkpack exceeds the ${ArkpackLimits.maxCompressedBytes} byte compressed limit.`,
								),
							);
						const bytes = Uint8Array.from(yield* fileSystem.readFile(arkpackPath));
						if ((yield* readArkpackContentHashFx(bytes)) !== contentHash)
							return yield* Effect.fail(
								new Error(
									"The current Editor build does not match the requested artifact.",
								),
							);
						const signaturePath = path.join(build, `${stem}.arksig`);
						const signatureExists = yield* fileSystem.exists(signaturePath);
						if (signatureExists !== signed)
							return yield* Effect.fail(
								new Error("The current Editor build signing state has changed."),
							);
						if (
							signatureExists &&
							(yield* fileSystem.realPath(signaturePath)) !== signaturePath
						)
							return yield* Effect.fail(
								new Error("The Editor build signature is a symbolic link."),
							);
						const signature = yield* Effect.succeed(signatureExists).pipe(
							Effect.flatMap((exists) =>
								exists
									? fileSystem.stat(signaturePath).pipe(
											Effect.filterOrFail(
												(info) =>
													info.size <= ArkpackLimits.maxSignatureBytes,
												() =>
													new Error(
														"The Editor build signature is too large.",
													),
											),
											Effect.andThen(
												fileSystem.readFileString(signaturePath),
											),
											Effect.map((source) =>
												ArkpackSignatureSchema.parse(source.trim()),
											),
										)
									: Effect.succeed(undefined),
							),
						);
						if (signature !== undefined) {
							if (ArkiniBuiltPublicKey === undefined)
								return yield* Effect.fail(
									new Error(
										"This Arkini build does not contain a public signing key.",
									),
								);
							const verification = yield* verifyArkpackTrustFx({
								bytes,
								publicKey: ArkiniBuiltPublicKey,
								signature,
							});
							if (verification.trust.type !== "official")
								return yield* Effect.fail(
									new Error("The current Editor build signature is invalid."),
								);
						}
						return EditorProjectBuildContentSchema.parse({
							bytes,
							...(signature === undefined
								? {}
								: {
										signature,
									}),
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

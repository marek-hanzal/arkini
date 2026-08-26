import { Buffer } from "node:buffer";
import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import type { FilesystemEditorProjectState } from "../FilesystemEditorProjectState";
import type { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import type { EditorProjectVersionReference } from "~/editor/version/EditorProjectVersion";
import { EditorBoardScenarioFileSchema } from "~/editor/filesystem/EditorBoardScenarioFileSchema";
import { readEditorProjectVersionApplicability } from "~/editor/version/readEditorProjectVersionApplicabilityFx";
import { hashFilesystemEditorVersionBytes } from "./FilesystemEditorVersionFingerprint";
import { createFilesystemEditorVersionSnapshotPlan } from "./createFilesystemEditorVersionSnapshotPlan";
import { readFilesystemEditorVersionSnapshotFx } from "./readFilesystemEditorVersionSnapshotFx";

export namespace createFilesystemEditorProjectVersionReaderFx {
	export interface Props {
		readonly readState: (
			projectId: string,
		) => Effect.Effect<FilesystemEditorProjectState, EditorProjectRepositoryError>;
	}
}

/** Reads published history and creates canonical current/version projections. */
export const createFilesystemEditorProjectVersionReaderFx = Effect.fn(
	"createFilesystemEditorProjectVersionReaderFx",
)(function* ({ readState }: createFilesystemEditorProjectVersionReaderFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const pathService = yield* Path.Path;
	const readHeadFx = (state: FilesystemEditorProjectState) =>
		Effect.succeed(state.versionHistory.head);

	const readDescriptorFx = Effect.fn("readFilesystemEditorVersionDescriptorFx")(function* (
		state: FilesystemEditorProjectState,
		versionId: string,
	) {
		const version = state.versionHistory.versions.get(versionId);
		return version === undefined
			? yield* Effect.fail(
					new Error(
						`Version ${versionId} does not exist in project ${state.project.projectId}.`,
					),
				)
			: version.descriptor;
	});

	const readPublishedVersionFx = Effect.fn("readPublishedFilesystemEditorVersionFx")(function* (
		state: FilesystemEditorProjectState,
		versionId: string,
	) {
		const head = yield* readHeadFx(state);
		if (head === undefined || !head.versionIds.includes(versionId))
			return yield* Effect.fail(
				new Error(
					`Version ${versionId} does not exist in project ${state.project.projectId}.`,
				),
			);
		const version = state.versionHistory.versions.get(versionId);
		return version === undefined
			? yield* Effect.fail(
					new Error(
						`Version ${versionId} does not exist in project ${state.project.projectId}.`,
					),
				)
			: version;
	});

	const readCurrentSnapshotFx = Effect.fn("readCurrentFilesystemEditorVersionSnapshotFx")(
		function* (projectId: string) {
			const state = yield* readState(projectId);
			const scenarios = state.scenarios.map((scenario) =>
				EditorBoardScenarioFileSchema.parse({
					name: scenario.name,
					projectRevision: scenario.projectRevision,
					arkpackVersion: scenario.version,
					bytesBase64: Buffer.from(scenario.bytes).toString("base64"),
					createdAtMs: scenario.createdAtMs,
					updatedAtMs: scenario.updatedAtMs,
				}),
			);
			const snapshot = yield* Effect.try({
				try: () =>
					createFilesystemEditorVersionSnapshotPlan({
						arkpack: state.project.version,
						config: state.project.config,
						resources: state.project.resources,
						scenarios,
					}),
				catch: (cause) =>
					new Error("The current Editor version snapshot is invalid.", {
						cause,
					}),
			});
			return {
				state,
				manifest: snapshot.manifest,
				contentFingerprint: snapshot.contentFingerprint,
			};
		},
	);

	const readDiffSnapshotFx = Effect.fn("readFilesystemEditorVersionDiffSnapshotFx")(function* (
		state: FilesystemEditorProjectState,
		reference: EditorProjectVersionReference,
	) {
		if (reference.type === "current")
			return {
				config: state.project.config,
				arkpackVersion: state.project.version,
				resources: new Map(
					state.project.resources.map((resource) => [
						resource.id,
						JSON.stringify([
							resource.mime,
							hashFilesystemEditorVersionBytes(resource.bytes),
						]),
					]),
				),
				scenarios: new Map(
					state.scenarios.map((scenario) => [
						scenario.name,
						JSON.stringify([
							scenario.version,
							hashFilesystemEditorVersionBytes(scenario.bytes),
						]),
					]),
				),
			};
		const version = yield* readPublishedVersionFx(state, reference.versionId);
		const applicability = readEditorProjectVersionApplicability(version.descriptor.arkini);
		if (applicability.type === "incompatible")
			return yield* Effect.fail(new Error(applicability.reason));
		const snapshot = yield* readFilesystemEditorVersionSnapshotFx({
			manifest: version.manifest,
			paths: state.paths,
		}).pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, pathService),
		);
		if (snapshot.contentFingerprint !== version.descriptor.contentFingerprint)
			return yield* Effect.fail(
				new Error(`Version ${reference.versionId} content does not match its descriptor.`),
			);
		if (snapshot.arkpack !== version.descriptor.arkpackVersion)
			return yield* Effect.fail(
				new Error(
					`Version ${reference.versionId} Arkpack version does not match its descriptor.`,
				),
			);
		return {
			config: snapshot.config,
			arkpackVersion: snapshot.arkpack,
			resources: new Map(
				snapshot.resources.map((resource) => [
					resource.id,
					JSON.stringify([
						resource.mime,
						hashFilesystemEditorVersionBytes(resource.bytes),
					]),
				]),
			),
			scenarios: new Map(
				snapshot.scenarios.map((scenario) => [
					scenario.name,
					JSON.stringify([
						scenario.arkpackVersion,
						hashFilesystemEditorVersionBytes(
							Buffer.from(scenario.bytesBase64, "base64"),
						),
					]),
				]),
			),
		};
	});

	return {
		readCurrentSnapshotFx,
		readDescriptorFx,
		readDiffSnapshotFx,
		readHeadFx,
		readPublishedVersionFx,
	};
});

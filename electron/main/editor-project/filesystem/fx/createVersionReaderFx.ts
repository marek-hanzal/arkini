import { Buffer } from "node:buffer";
import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import type { ProjectState } from "../ProjectState";
import type { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { ProjectVersionReference } from "~/project-version/type/ProjectVersion";
import { BoardScenarioFileSchema } from "~/board-scenario/schema/BoardScenarioFileSchema";
import { hashVersionBytes } from "./VersionFingerprint";
import { planVersionSnapshotFx } from "./planVersionSnapshotFx";
import { readVersionSnapshotFx } from "./readVersionSnapshotFx";

export namespace createVersionReaderFx {
	export interface Props {
		readonly readState: (
			projectId: string,
		) => Effect.Effect<ProjectState, ProjectRepositoryError>;
	}
}

/** Reads published history and creates canonical current/version projections. */
export const createVersionReaderFx = Effect.fn("createVersionReaderFx")(function* ({
	readState,
}: createVersionReaderFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const pathService = yield* Path.Path;
	const readHeadFx = (state: ProjectState) => Effect.succeed(state.versionHistory.head);

	const readDescriptorFx = Effect.fn("readVersionDescriptorFx")(function* (
		state: ProjectState,
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

	const readPublishedVersionFx = Effect.fn("readPublishedVersionFx")(function* (
		state: ProjectState,
		versionId: string,
	) {
		const head = yield* readHeadFx(state);
		if (head === undefined || !head.versions.includes(versionId))
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

	const readCurrentSnapshotFx = Effect.fn("readCurrentVersionSnapshotFx")(function* (
		projectId: string,
	) {
		const state = yield* readState(projectId);
		const scenarios = state.scenarios.map((scenario) =>
			BoardScenarioFileSchema.parse({
				name: scenario.name,
				revision: scenario.projectRevision,
				version: scenario.version,
				save: Buffer.from(scenario.bytes).toString("base64"),
				createdAtMs: scenario.createdAtMs,
				updatedAtMs: scenario.updatedAtMs,
			}),
		);
		const snapshot = yield* planVersionSnapshotFx({
			arkpack: state.project.version,
			config: state.project.config,
			resources: state.project.resources,
			scenarios,
		}).pipe(
			Effect.mapError(
				(cause) =>
					new Error("The current Editor version snapshot is invalid.", {
						cause,
					}),
			),
		);
		return {
			state,
			manifest: snapshot.manifest,
			contentFingerprint: snapshot.contentFingerprint,
		};
	});

	const readDiffSnapshotFx = Effect.fn("readVersionDiffSnapshotFx")(function* (
		state: ProjectState,
		reference: ProjectVersionReference,
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
							hashVersionBytes(resource.bytes),
						]),
					]),
				),
				scenarios: new Map(
					state.scenarios.map((scenario) => [
						scenario.name,
						JSON.stringify([
							scenario.version,
							hashVersionBytes(scenario.bytes),
						]),
					]),
				),
			};
		const version = yield* readPublishedVersionFx(state, reference.versionId);
		const snapshot = yield* readVersionSnapshotFx({
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
		if (snapshot.arkpack !== version.descriptor.version)
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
						hashVersionBytes(resource.bytes),
					]),
				]),
			),
			scenarios: new Map(
				snapshot.scenarios.map((scenario) => [
					scenario.name,
					JSON.stringify([
						scenario.version,
						hashVersionBytes(Buffer.from(scenario.save, "base64")),
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

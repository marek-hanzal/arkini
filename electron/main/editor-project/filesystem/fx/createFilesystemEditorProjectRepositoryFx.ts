import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path, Semaphore } from "effect";

import type { OwnedEditorProjectRepository } from "../../EditorProjectServiceOwnership";
import type { ProjectState } from "../ProjectState";
import { EditorProjectRepositoryError } from "~/project-authoring/repository/EditorProjectRepositoryError";
import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";
import { createBoardScenarioOperationsFx } from "./createBoardScenarioOperationsFx";
import { createNoteOperationsFx } from "./createNoteOperationsFx";
import { createProjectCatalogFx } from "./createProjectCatalogFx";
import { createBuildOperationsFx } from "./createBuildOperationsFx";
import { createCommitOperationsFx } from "./createCommitOperationsFx";
import { createLifecycleOperationsFx } from "./createLifecycleOperationsFx";
import { createVersionOperationsFx } from "./createVersionOperationsFx";

export namespace createFilesystemEditorProjectRepositoryFx {
	export interface Props {
		readonly catalogPath: string;
		readonly fileSystem?: FileSystem.FileSystem;
		readonly projectsRoot: string;
	}
}

const createRepositoryFx = Effect.fn("createFilesystemEditorProjectRepositoryFx")(function* ({
	catalogPath,
	projectsRoot,
}: createFilesystemEditorProjectRepositoryFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const operations = yield* Semaphore.make(1);
	const filesystemWrite = yield* createFilesystemWriteFx();
	const states = new Map<string, ProjectState>();
	const catalog = yield* createProjectCatalogFx({
		catalogPath,
		projectsRoot,
	});
	const projects = yield* createLifecycleOperationsFx({
		catalog,
		filesystemWrite,
		operations,
		projectsRoot,
		states,
	});
	const readState = (projectId: string) => {
		const state = states.get(projectId);
		return state === undefined
			? Effect.fail(
					new EditorProjectRepositoryError({
						operation: "read-project",
						message: `Editor project ${projectId} does not exist.`,
					}),
				)
			: Effect.succeed(state);
	};
	const commits = yield* createCommitOperationsFx({
		operations,
		readState,
		states,
	});
	const builds = yield* createBuildOperationsFx({
		filesystemWrite,
		operations,
		readState,
	});
	const boardScenarios = yield* createBoardScenarioOperationsFx({
		filesystemWrite,
		operations,
		readState,
		states,
	});
	const notes = yield* createNoteOperationsFx({
		filesystemWrite,
		operations,
		readState,
		states,
	});
	const versions = yield* createVersionOperationsFx({
		filesystemWrite,
		operations,
		readState,
		states,
	});
	const repository = {
		awaitIdleFx: operations.withPermits(1)(Effect.void),
		...projects,
		...builds,
		...commits,
		...boardScenarios,
		...notes,
		...versions,
		closeFx: operations.withPermits(1)(Effect.void),
	} satisfies OwnedEditorProjectRepository;
	const provide = <Value, Failure>(effect: Effect.Effect<Value, Failure>) =>
		effect.pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, path),
		);

	return {
		awaitIdleFx: provide(repository.awaitIdleFx),
		buildProjectFx: (props) => provide(repository.buildProjectFx(props)),
		createProjectFx: (props) => provide(repository.createProjectFx(props)),
		deleteProjectFx: (projectId) => provide(repository.deleteProjectFx(projectId)),
		openProjectFx: (props) => provide(repository.openProjectFx(props)),
		readProjectFx: (projectId) => provide(repository.readProjectFx(projectId)),
		readProjectBuildFx: (props) => provide(repository.readProjectBuildFx(props)),
		readProjectRootFx: (projectId) => provide(repository.readProjectRootFx(projectId)),
		refreshProjectFx: (projectId) => provide(repository.refreshProjectFx(projectId)),
		listProjectsFx: provide(repository.listProjectsFx),
		deleteItemFx: (props) => provide(repository.deleteItemFx(props)),
		deleteResourceFx: (props) => provide(repository.deleteResourceFx(props)),
		replaceConfigFx: (props) => provide(repository.replaceConfigFx(props)),
		replaceResourceFx: (props) => provide(repository.replaceResourceFx(props)),
		saveResourceFx: (props) => provide(repository.saveResourceFx(props)),
		upsertItemFx: (props) => provide(repository.upsertItemFx(props)),
		upsertResourcesFx: (props) => provide(repository.upsertResourcesFx(props)),
		listBoardScenariosFx: (projectId) => provide(repository.listBoardScenariosFx(projectId)),
		readBoardScenarioFx: (key) => provide(repository.readBoardScenarioFx(key)),
		writeBoardScenarioFx: (props) => provide(repository.writeBoardScenarioFx(props)),
		deleteBoardScenarioFx: (key) => provide(repository.deleteBoardScenarioFx(key)),
		listNotesFx: (projectId) => provide(repository.listNotesFx(projectId)),
		createNoteFx: (props) => provide(repository.createNoteFx(props)),
		updateNoteFx: (props) => provide(repository.updateNoteFx(props)),
		deleteNoteFx: (key) => provide(repository.deleteNoteFx(key)),
		checkoutVersionFx: (props) => provide(repository.checkoutVersionFx(props)),
		createVersionFx: (props) => provide(repository.createVersionFx(props)),
		diffVersionsFx: (props) => provide(repository.diffVersionsFx(props)),
		listVersionsFx: (projectId) => provide(repository.listVersionsFx(projectId)),
		readVersionStatusFx: (projectId) => provide(repository.readVersionStatusFx(projectId)),
		updateVersionTagFx: (props) => provide(repository.updateVersionTagFx(props)),
		closeFx: provide(repository.closeFx),
	} satisfies OwnedEditorProjectRepository;
});

export type FilesystemEditorProjectRepository = OwnedEditorProjectRepository;

/** Composes one filesystem-backed Editor repository with its Node platform services. */
export const createFilesystemEditorProjectRepositoryFx = (
	props: createFilesystemEditorProjectRepositoryFx.Props,
) =>
	Effect.gen(function* () {
		const fileSystem = props.fileSystem ?? (yield* FileSystem.FileSystem);
		return yield* createRepositoryFx(props).pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
		);
	}).pipe(Effect.provide(NodeServices.layer));

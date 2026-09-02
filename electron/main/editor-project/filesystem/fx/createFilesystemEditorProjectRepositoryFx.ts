import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path, Semaphore } from "effect";

import type { OwnedEditorProjectRepository } from "~electron/main/editor-project/EditorProjectServiceOwnership";
import type { ProjectState } from "../ProjectState";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";
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
	const readStateFx = (projectId: string) => {
		const state = states.get(projectId);
		return state === undefined
			? Effect.fail(
					new ProjectRepositoryError({
						operation: "read-project",
						message: `Editor project ${projectId} does not exist.`,
					}),
				)
			: Effect.succeed(state);
	};
	const commits = yield* createCommitOperationsFx({
		operations,
		readStateFx,
		states,
	});
	const builds = yield* createBuildOperationsFx({
		filesystemWrite,
		operations,
		readStateFx,
	});
	const boardScenarios = yield* createBoardScenarioOperationsFx({
		filesystemWrite,
		operations,
		readStateFx,
		states,
	});
	const notes = yield* createNoteOperationsFx({
		filesystemWrite,
		operations,
		readStateFx,
		states,
	});
	const versions = yield* createVersionOperationsFx({
		filesystemWrite,
		operations,
		readStateFx,
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
	const provideFx = <Value, Failure>(effect: Effect.Effect<Value, Failure, never>) =>
		effect.pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, path),
		);

	return {
		awaitIdleFx: provideFx(repository.awaitIdleFx),
		buildProjectFx: (props) => provideFx(repository.buildProjectFx(props)),
		createProjectFx: (props) => provideFx(repository.createProjectFx(props)),
		deleteProjectFx: (projectId) => provideFx(repository.deleteProjectFx(projectId)),
		openProjectFx: (props) => provideFx(repository.openProjectFx(props)),
		readProjectFx: (projectId) => provideFx(repository.readProjectFx(projectId)),
		readProjectBuildFx: (props) => provideFx(repository.readProjectBuildFx(props)),
		readProjectRootFx: (projectId) => provideFx(repository.readProjectRootFx(projectId)),
		refreshProjectFx: (projectId) => provideFx(repository.refreshProjectFx(projectId)),
		listProjectsFx: provideFx(repository.listProjectsFx),
		deleteItemFx: (props) => provideFx(repository.deleteItemFx(props)),
		deleteResourceFx: (props) => provideFx(repository.deleteResourceFx(props)),
		replaceConfigFx: (props) => provideFx(repository.replaceConfigFx(props)),
		replaceResourceFx: (props) => provideFx(repository.replaceResourceFx(props)),
		saveResourceFx: (props) => provideFx(repository.saveResourceFx(props)),
		upsertItemFx: (props) => provideFx(repository.upsertItemFx(props)),
		upsertResourcesFx: (props) => provideFx(repository.upsertResourcesFx(props)),
		listBoardScenariosFx: (projectId) => provideFx(repository.listBoardScenariosFx(projectId)),
		readBoardScenarioFx: (key) => provideFx(repository.readBoardScenarioFx(key)),
		writeBoardScenarioFx: (props) => provideFx(repository.writeBoardScenarioFx(props)),
		deleteBoardScenarioFx: (key) => provideFx(repository.deleteBoardScenarioFx(key)),
		listNotesFx: (projectId) => provideFx(repository.listNotesFx(projectId)),
		createNoteFx: (props) => provideFx(repository.createNoteFx(props)),
		updateNoteFx: (props) => provideFx(repository.updateNoteFx(props)),
		deleteNoteFx: (key) => provideFx(repository.deleteNoteFx(key)),
		checkoutVersionFx: (props) => provideFx(repository.checkoutVersionFx(props)),
		createVersionFx: (props) => provideFx(repository.createVersionFx(props)),
		diffVersionsFx: (props) => provideFx(repository.diffVersionsFx(props)),
		listVersionsFx: (projectId) => provideFx(repository.listVersionsFx(projectId)),
		previewVersionCommitFx: (projectId) =>
			provideFx(repository.previewVersionCommitFx(projectId)),
		readVersionStatusFx: (projectId) => provideFx(repository.readVersionStatusFx(projectId)),
		updateVersionTagFx: (props) => provideFx(repository.updateVersionTagFx(props)),
		closeFx: provideFx(repository.closeFx),
	} satisfies OwnedEditorProjectRepository;
});

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

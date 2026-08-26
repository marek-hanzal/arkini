import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Semaphore } from "effect";

import type { OwnedEditorProjectRepository } from "../../EditorProjectServiceOwnership";
import type { FilesystemEditorProjectState } from "../FilesystemEditorProjectState";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { createFilesystemEditorBoardScenarioOperationsFx } from "./createFilesystemEditorBoardScenarioOperationsFx";
import { createFilesystemEditorNoteOperationsFx } from "./createFilesystemEditorNoteOperationsFx";
import { createFilesystemEditorProjectCatalogFx } from "./createFilesystemEditorProjectCatalogFx";
import { createFilesystemEditorProjectBuildOperationsFx } from "./createFilesystemEditorProjectBuildOperationsFx";
import { createFilesystemEditorProjectCommitOperationsFx } from "./createFilesystemEditorProjectCommitOperationsFx";
import { createFilesystemEditorProjectOperationsFx } from "./createFilesystemEditorProjectOperationsFx";
import { createFilesystemEditorProjectVersionOperationsFx } from "./createFilesystemEditorProjectVersionOperationsFx";

export namespace createFilesystemEditorProjectRepositoryFx {
	export interface Props {
		readonly catalogPath: string;
		readonly projectsRoot: string;
	}
}

const createRepositoryFx = Effect.fn("createFilesystemEditorProjectRepositoryFx")(function* ({
	catalogPath,
	projectsRoot,
}: createFilesystemEditorProjectRepositoryFx.Props) {
	const operations = yield* Semaphore.make(1);
	const states = new Map<string, FilesystemEditorProjectState>();
	const catalog = yield* createFilesystemEditorProjectCatalogFx({
		catalogPath,
	});
	const projects = yield* createFilesystemEditorProjectOperationsFx({
		catalog,
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
	const commits = yield* createFilesystemEditorProjectCommitOperationsFx({
		operations,
		readState,
		states,
	});
	const builds = yield* createFilesystemEditorProjectBuildOperationsFx({
		operations,
		readState,
	});
	const boardScenarios = yield* createFilesystemEditorBoardScenarioOperationsFx({
		operations,
		readState,
		states,
	});
	const notes = yield* createFilesystemEditorNoteOperationsFx({
		operations,
		readState,
		states,
	});
	const versions = yield* createFilesystemEditorProjectVersionOperationsFx({
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
		effect.pipe(Effect.provide(NodeServices.layer));

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
) => createRepositoryFx(props).pipe(Effect.provide(NodeServices.layer));

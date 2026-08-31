import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import type { EditorBoardGame } from "~/board-scenario/type/EditorBoardGame";
import { encodeArkiniSaveFn } from "~/game-persistence/fn/encodeArkiniSaveFn";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";

export namespace saveBoardScenarioFx {
	export interface Props {
		readonly game: EditorBoardGame;
		readonly name: string;
		readonly project: Project;
	}
}

/** Persists one explicit snapshot of the exact canonical editor game. */
export const saveBoardScenarioFx = Effect.fn("saveEditorBoardScenarioFx")(function* ({
	game,
	name,
	project,
}: saveBoardScenarioFx.Props) {
	const state = fromRuntimeFn({
		runtime: game.getSnapshotFn(),
	});
	const bytes = encodeArkiniSaveFn({
		version: project.version,
		state,
	});
	const repository = yield* ProjectRepository;
	return yield* repository.writeBoardScenarioFx({
		projectId: project.projectId,
		expectedRevision: project.revision,
		name,
		bytes,
	});
});

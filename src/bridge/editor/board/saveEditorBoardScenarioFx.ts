import { Effect } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import type { EditorBoardGame } from "~/bridge/editor/board/EditorBoardGame";
import { encodeArkiniSaveFx } from "~/bridge/save/encodeArkiniSaveFx";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";

export namespace saveEditorBoardScenarioFx {
	export interface Props {
		readonly game: EditorBoardGame;
		readonly name: string;
		readonly project: EditorProject;
	}
}

/** Persists one explicit snapshot of the exact canonical editor game. */
export const saveEditorBoardScenarioFx = Effect.fn("saveEditorBoardScenarioFx")(function* ({
	game,
	name,
	project,
}: saveEditorBoardScenarioFx.Props) {
	const state = yield* fromRuntimeFx({
		runtime: game.getSnapshot(),
	});
	const bytes = yield* encodeArkiniSaveFx({
		version: project.version,
		state,
	});
	const repository = yield* EditorProjectRepository;
	return yield* repository.writeBoardScenarioFx({
		projectId: project.projectId,
		expectedRevision: project.revision,
		name,
		bytes,
	});
});

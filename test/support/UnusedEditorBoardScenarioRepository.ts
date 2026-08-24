import { Effect } from "effect";

import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";

/** Explicitly unavailable scenario methods for tests outside the Board-scenario domain. */
export const UnusedEditorBoardScenarioRepository = {
	listBoardScenariosFx: () => Effect.die("Unexpected Board scenario list."),
	readBoardScenarioFx: () => Effect.die("Unexpected Board scenario read."),
	writeBoardScenarioFx: () => Effect.die("Unexpected Board scenario write."),
	deleteBoardScenarioFx: () => Effect.die("Unexpected Board scenario delete."),
} satisfies Pick<
	EditorProjectRepositoryService,
	| "listBoardScenariosFx"
	| "readBoardScenarioFx"
	| "writeBoardScenarioFx"
	| "deleteBoardScenarioFx"
>;

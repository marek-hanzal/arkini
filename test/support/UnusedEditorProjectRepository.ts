import { Effect } from "effect";

import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";

/** Explicitly unavailable repository domains for focused tests outside their ownership. */
export const UnusedEditorProjectRepository = {
	deleteProjectFx: () => Effect.die("Unexpected editor project deletion."),
	listBoardScenariosFx: () => Effect.die("Unexpected Board scenario list."),
	readBoardScenarioFx: () => Effect.die("Unexpected Board scenario read."),
	saveResourceFx: () => Effect.die("Unexpected single resource save."),
	writeBoardScenarioFx: () => Effect.die("Unexpected Board scenario write."),
	deleteBoardScenarioFx: () => Effect.die("Unexpected Board scenario delete."),
} satisfies Pick<
	EditorProjectRepositoryService,
	| "deleteProjectFx"
	| "listBoardScenariosFx"
	| "readBoardScenarioFx"
	| "saveResourceFx"
	| "writeBoardScenarioFx"
	| "deleteBoardScenarioFx"
>;

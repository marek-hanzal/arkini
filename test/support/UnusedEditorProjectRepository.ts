import { Effect } from "effect";

import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";

/** Explicitly unavailable repository domains for focused tests outside their ownership. */
export const UnusedEditorProjectRepository = {
	checkoutVersionFx: () => Effect.die("Unexpected editor version checkout."),
	createVersionFx: () => Effect.die("Unexpected editor version commit."),
	deleteProjectFx: () => Effect.die("Unexpected editor project deletion."),
	diffVersionsFx: () => Effect.die("Unexpected editor version diff."),
	listVersionsFx: () => Effect.die("Unexpected editor version list."),
	readVersionStatusFx: () => Effect.die("Unexpected editor version status."),
	updateVersionTagFx: () => Effect.die("Unexpected editor version tag update."),
	listBoardScenariosFx: () => Effect.die("Unexpected Board scenario list."),
	readBoardScenarioFx: () => Effect.die("Unexpected Board scenario read."),
	saveResourceFx: () => Effect.die("Unexpected single resource save."),
	writeBoardScenarioFx: () => Effect.die("Unexpected Board scenario write."),
	deleteBoardScenarioFx: () => Effect.die("Unexpected Board scenario delete."),
} satisfies Pick<
	EditorProjectRepositoryService,
	| "deleteProjectFx"
	| "checkoutVersionFx"
	| "createVersionFx"
	| "diffVersionsFx"
	| "listVersionsFx"
	| "readVersionStatusFx"
	| "updateVersionTagFx"
	| "listBoardScenariosFx"
	| "readBoardScenarioFx"
	| "saveResourceFx"
	| "writeBoardScenarioFx"
	| "deleteBoardScenarioFx"
>;

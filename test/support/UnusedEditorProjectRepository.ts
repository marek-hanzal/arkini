import { Effect } from "effect";

import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";

/** Explicitly unavailable repository domains for focused tests outside their ownership. */
export const UnusedEditorProjectRepository = {
	checkoutVersionFx: () => Effect.die("Unexpected editor version checkout."),
	createVersionFx: () => Effect.die("Unexpected editor version commit."),
	createNoteFx: () => Effect.die("Unexpected editor note create."),
	deleteNoteFx: () => Effect.die("Unexpected editor note delete."),
	deleteProjectFx: () => Effect.die("Unexpected editor project deletion."),
	deleteResourceFx: () => Effect.die("Unexpected editor resource deletion."),
	diffVersionsFx: () => Effect.die("Unexpected editor version diff."),
	listVersionsFx: () => Effect.die("Unexpected editor version list."),
	listNotesFx: () => Effect.die("Unexpected editor note list."),
	readVersionStatusFx: () => Effect.die("Unexpected editor version status."),
	updateVersionTagFx: () => Effect.die("Unexpected editor version tag update."),
	updateNoteFx: () => Effect.die("Unexpected editor note update."),
	listBoardScenariosFx: () => Effect.die("Unexpected Board scenario list."),
	readBoardScenarioFx: () => Effect.die("Unexpected Board scenario read."),
	saveResourceFx: () => Effect.die("Unexpected single resource save."),
	writeBoardScenarioFx: () => Effect.die("Unexpected Board scenario write."),
	deleteBoardScenarioFx: () => Effect.die("Unexpected Board scenario delete."),
} satisfies Pick<
	EditorProjectRepositoryService,
	| "deleteProjectFx"
	| "deleteResourceFx"
	| "checkoutVersionFx"
	| "createVersionFx"
	| "createNoteFx"
	| "deleteNoteFx"
	| "diffVersionsFx"
	| "listVersionsFx"
	| "listNotesFx"
	| "readVersionStatusFx"
	| "updateVersionTagFx"
	| "updateNoteFx"
	| "listBoardScenariosFx"
	| "readBoardScenarioFx"
	| "saveResourceFx"
	| "writeBoardScenarioFx"
	| "deleteBoardScenarioFx"
>;

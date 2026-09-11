import { Effect } from "effect";

import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";

/** Explicitly unavailable repository domains for focused tests outside their ownership. */
export const UnusedEditorProjectRepository = {
	bakeTilePaintingsFx: () => Effect.die("Unexpected painting batch."),
	listTilePaintingsFx: () => Effect.die("Unexpected painting list."),
	readTilePaintingFx: () => Effect.die("Unexpected painting read."),
	saveTilePaintingFx: () => Effect.die("Unexpected painting save."),
	deleteTilePaintingFx: () => Effect.die("Unexpected painting delete."),
	createNoteFx: () => Effect.die("Unexpected editor note create."),
	deleteNoteFx: () => Effect.die("Unexpected editor note delete."),
	deleteProjectFx: () => Effect.die("Unexpected editor project deletion."),
	deleteResourceFx: () => Effect.die("Unexpected editor resource deletion."),
	optimizeResourcesFx: () => Effect.die("Unexpected editor resource optimization."),
	listNotesFx: () => Effect.die("Unexpected editor note list."),
	updateNoteFx: () => Effect.die("Unexpected editor note update."),
} satisfies Pick<
	ProjectRepositoryService,
	| "bakeTilePaintingsFx"
	| "listTilePaintingsFx"
	| "readTilePaintingFx"
	| "saveTilePaintingFx"
	| "deleteTilePaintingFx"
	| "deleteProjectFx"
	| "deleteResourceFx"
	| "optimizeResourcesFx"
	| "createNoteFx"
	| "deleteNoteFx"
	| "listNotesFx"
	| "updateNoteFx"
>;

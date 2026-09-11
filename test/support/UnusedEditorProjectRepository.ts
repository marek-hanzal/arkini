import { Effect } from "effect";

import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";

/** Explicitly unavailable repository domains for focused tests outside their ownership. */
export const UnusedEditorProjectRepository = {
	createNoteFx: () => Effect.die("Unexpected editor note create."),
	deleteNoteFx: () => Effect.die("Unexpected editor note delete."),
	deleteProjectFx: () => Effect.die("Unexpected editor project deletion."),
	deleteResourceFx: () => Effect.die("Unexpected editor resource deletion."),
	optimizeResourcesFx: () => Effect.die("Unexpected editor resource optimization."),
	listNotesFx: () => Effect.die("Unexpected editor note list."),
	updateNoteFx: () => Effect.die("Unexpected editor note update."),
} satisfies Pick<
	ProjectRepositoryService,
	| "deleteProjectFx"
	| "deleteResourceFx"
	| "optimizeResourcesFx"
	| "createNoteFx"
	| "deleteNoteFx"
	| "listNotesFx"
	| "updateNoteFx"
>;

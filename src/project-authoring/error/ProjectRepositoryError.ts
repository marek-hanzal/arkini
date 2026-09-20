import { Data } from "effect";

import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";

export type ProjectRepositoryOperation =
	| "await-idle"
	| "build-project"
	| "save-build-version"
	| "create-project"
	| "create-note"
	| "dismiss-invalid-project"
	| "delete-project"
	| "delete-item"
	| "delete-resource"
	| "delete-note"
	| "export-json-directory"
	| "import-json-directory"
	| "import-serapack"
	| "list-notes"
	| "list-projects"
	| "open-project-directory"
	| "optimize-resources"
	| "read-project"
	| "read-project-build"
	| "replace-config"
	| "replace-resource"
	| "refresh-project"
	| "save-project-build"
	| "save-resource-metadata"
	| "upsert-item"
	| "upsert-resource"
	| "update-note";

/** One canonical editor-project repository operation failed. */
export class ProjectRepositoryError extends Data.TaggedError("EditorProjectRepositoryError")<{
	readonly operation: ProjectRepositoryOperation;
	readonly reason?: "revision-conflict";
	readonly message: string;
	readonly diagnostics?: GameDiagnosticsSchema.Type;
	readonly cause?: unknown;
}> {}

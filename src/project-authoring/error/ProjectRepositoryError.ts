import { Data } from "effect";

import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";

export type ProjectRepositoryOperation =
	| "await-idle"
	| "build-project"
	| "checkout-version"
	| "create-version"
	| "create-project"
	| "create-note"
	| "delete-project"
	| "delete-item"
	| "delete-resource"
	| "delete-note"
	| "delete-board-scenario"
	| "diff-versions"
	| "export-json-directory"
	| "import-json-directory"
	| "list-board-scenarios"
	| "list-notes"
	| "list-projects"
	| "list-versions"
	| "open-project-directory"
	| "read-project"
	| "read-project-build"
	| "read-version-status"
	| "read-board-scenario"
	| "replace-config"
	| "replace-resource"
	| "refresh-project"
	| "save-resource"
	| "save-project-build"
	| "upsert-item"
	| "upsert-resource"
	| "update-version-tag"
	| "update-note"
	| "write-board-scenario";

/** One canonical editor-project repository operation failed. */
export class ProjectRepositoryError extends Data.TaggedError("EditorProjectRepositoryError")<{
	readonly operation: ProjectRepositoryOperation;
	readonly message: string;
	readonly diagnostics?: GameDiagnosticsSchema.Type;
	readonly cause?: unknown;
}> {}

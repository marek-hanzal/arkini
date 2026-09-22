import type { VersionPartsSchema } from "~/game-version/schema/VersionPartsSchema";
import { Context, type Effect } from "effect";

import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import type { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";

export interface ReadEditorBuildProps {
	readonly contentHash: string;
	readonly expectedRevision: number;
	readonly projectId: string;
}

export interface EditorBuildRepositoryService {
	readonly saveBuildVersionFx: (props: {
		readonly projectId: string;
		readonly version: VersionPartsSchema.Type;
	}) => Effect.Effect<VersionPartsSchema.Type, ProjectRepositoryError, never>;
	readonly buildProjectFx: (props: {
		readonly projectId: string;
	}) => Effect.Effect<EditorProjectBuildSchema.Type, ProjectRepositoryError, never>;
}

/** Renderer capability for producing exact revision-pinned Editor artifacts. */
export class EditorBuildRepository extends Context.Service<
	EditorBuildRepository,
	EditorBuildRepositoryService
>()("EditorBuildRepository") {
	//
}

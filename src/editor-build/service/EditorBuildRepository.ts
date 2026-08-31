import { Context, type Effect } from "effect";

import type {
	EditorProjectBuildContentSchema,
	EditorProjectBuildSchema,
} from "~/editor-build/schema/EditorProjectBuildSchema";
import type { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";

interface EditorBuildProps {
	readonly expectedRevision: number;
	readonly projectId: string;
}

interface ReadEditorBuildProps {
	readonly contentHash: string;
	readonly expectedRevision: number;
	readonly projectId: string;
}

export interface EditorBuildRepositoryService {
	readonly buildProjectFx: (
		props: EditorBuildProps,
	) => Effect.Effect<EditorProjectBuildSchema.Type, ProjectRepositoryError, never>;
	readonly readProjectBuildFx: (
		props: ReadEditorBuildProps,
	) => Effect.Effect<EditorProjectBuildContentSchema.Type, ProjectRepositoryError, never>;
}

/** Renderer capability for building and rereading exact revision-pinned Editor artifacts. */
export class EditorBuildRepository extends Context.Service<
	EditorBuildRepository,
	EditorBuildRepositoryService
>()("EditorBuildRepository") {
	//
}

import { Context, type Effect } from "effect";

import type {
	EditorProjectBuildContentSchema,
	EditorProjectBuildSchema,
} from "~/editor-build/domain/EditorProjectBuildSchema";
import type { EditorProjectRepositoryError } from "~/project-authoring/error/EditorProjectRepositoryError";

export namespace EditorBuildRepository {
	export interface BuildProps {
		readonly expectedRevision: number;
		readonly projectId: string;
	}

	export interface ReadProps {
		readonly contentHash: string;
		readonly expectedRevision: number;
		readonly projectId: string;
	}
}

export interface EditorBuildRepositoryService {
	readonly buildProjectFx: (
		props: EditorBuildRepository.BuildProps,
	) => Effect.Effect<EditorProjectBuildSchema.Type, EditorProjectRepositoryError>;
	readonly readProjectBuildFx: (
		props: EditorBuildRepository.ReadProps,
	) => Effect.Effect<EditorProjectBuildContentSchema.Type, EditorProjectRepositoryError>;
}

/** Renderer capability for building and rereading exact revision-pinned Editor artifacts. */
export class EditorBuildRepository extends Context.Service<
	EditorBuildRepository,
	EditorBuildRepositoryService
>()("EditorBuildRepository") {
	//
}

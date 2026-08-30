import type { Effect } from "effect";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import type {
	EditorProjectRepository,
	EditorProjectRepositoryService,
} from "~/project-authoring/service/EditorProjectRepository";
import type { EditorProjectRepositoryError } from "~/project-authoring/error/EditorProjectRepositoryError";
import type { EditorBuildRepositoryService } from "~/editor-build/domain/EditorBuildRepository";

export interface OwnedEditorProjectRepository
	extends EditorProjectRepositoryService,
		EditorBuildRepositoryService {
	readonly closeFx: Effect.Effect<void>;
	readonly openProjectFx: (
		props: EditorProjectRepository.OpenProjectProps,
	) => Effect.Effect<EditorProject, EditorProjectRepositoryError>;
	readonly readProjectRootFx: (
		projectId: string,
	) => Effect.Effect<string | null, EditorProjectRepositoryError>;
	readonly refreshProjectFx: (
		projectId: string,
	) => Effect.Effect<EditorProject, EditorProjectRepositoryError>;
}

/** Editor persistence may fail independently; gameplay must still boot. */
export type EditorProjectServiceOwnership =
	| {
			readonly type: "ready";
			readonly repository: OwnedEditorProjectRepository;
	  }
	| {
			readonly type: "unavailable";
			readonly message: string;
	  };

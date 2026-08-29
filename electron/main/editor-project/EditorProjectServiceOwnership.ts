import type { Effect } from "effect";

import type { EditorProject } from "~/editor/EditorProject";
import type {
	EditorProjectRepository,
	EditorProjectRepositoryService,
} from "~/editor/EditorProjectRepository";
import type { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
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

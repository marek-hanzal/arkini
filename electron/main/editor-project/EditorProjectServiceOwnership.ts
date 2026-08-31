import type { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type {
	ProjectRepository,
	ProjectRepositoryService,
} from "~/project-authoring/service/ProjectRepository";
import type { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { EditorBuildRepositoryService } from "~/editor-build/service/EditorBuildRepository";

export interface OwnedEditorProjectRepository
	extends ProjectRepositoryService,
		EditorBuildRepositoryService {
	readonly closeFx: Effect.Effect<void>;
	readonly openProjectFx: (
		props: ProjectRepository.OpenProjectProps,
	) => Effect.Effect<Project, ProjectRepositoryError>;
	readonly readProjectRootFx: (
		projectId: string,
	) => Effect.Effect<string | null, ProjectRepositoryError>;
	readonly refreshProjectFx: (
		projectId: string,
	) => Effect.Effect<Project, ProjectRepositoryError>;
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

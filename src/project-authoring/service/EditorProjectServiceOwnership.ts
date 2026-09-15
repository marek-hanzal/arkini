import type { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type {
	ProjectRepository,
	ProjectRepositoryService,
} from "~/project-authoring/service/ProjectRepository";
import type { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { EditorBuildRepositoryService } from "~/editor-build/service/EditorBuildRepository";
import type { ReadEditorBuildProps } from "~/editor-build/service/EditorBuildRepository";

export interface OwnedEditorProjectRepository
	extends ProjectRepositoryService,
		EditorBuildRepositoryService {
	readonly dismissInvalidProjectFx: (
		root: string,
	) => Effect.Effect<void, ProjectRepositoryError, never>;
	readonly importArkpackFileFx: (
		arkpackPath: string,
	) => Effect.Effect<Project, ProjectRepositoryError, never>;
	readonly upsertResourceFilesFx: (props: {
		readonly projectId: string;
		readonly resources: ReadonlyArray<{
			readonly id: string;
			readonly mime: "image/png";
			readonly path: string;
			readonly size: number;
		}>;
	}) => Effect.Effect<Project, ProjectRepositoryError, never>;
	readonly readResourceLocationFx: (props: {
		readonly projectId: string;
		readonly resourceId: string;
	}) => Effect.Effect<
		{
			readonly root: string;
			readonly path: string;
			readonly version: string;
			readonly size: number;
		} | null,
		ProjectRepositoryError,
		never
	>;
	readonly withProjectBuildPathFx: <Value, Failure>(
		props: ReadEditorBuildProps,
		useFx: (path: string) => Effect.Effect<Value, Failure, never>,
	) => Effect.Effect<Value, ProjectRepositoryError | Failure, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
	readonly openProjectFx: (
		props: ProjectRepository.OpenProjectProps,
	) => Effect.Effect<Project, ProjectRepositoryError, never>;
	readonly readProjectRootFx: (
		projectId: string,
	) => Effect.Effect<string | null, ProjectRepositoryError, never>;
	readonly refreshProjectFx: (
		projectId: string,
	) => Effect.Effect<Project, ProjectRepositoryError, never>;
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

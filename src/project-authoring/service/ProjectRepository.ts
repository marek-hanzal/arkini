import { Context, type Effect } from "effect";

import type { Project, ProjectCommit } from "~/project-authoring/type/Project";
import type { ProjectCandidate } from "~/project-authoring/schema/ProjectCandidateSchema";
import type { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { NoteSchema } from "~/project-note/schema/NoteSchema";
import type {
	BoardScenarioDescriptorSchema,
	BoardScenarioSchema,
} from "~/board-scenario/schema/BoardScenarioSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import type { ProjectVersionRepositoryService } from "~/project-version/type/ProjectVersion";

export namespace ProjectRepository {
	export interface CreateProjectProps {
		readonly version: GameVersionSchema.Type;
		readonly config: GameConfigSchema.Type;
		readonly initialVersionSubject?: string;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
	}

	export interface OpenProjectProps {
		readonly root: string;
	}

	export interface UpsertItemProps {
		readonly expectedRevision?: number;
		readonly projectId: string;
		readonly item: ItemSchema.Type;
	}

	export interface DeleteItemProps {
		readonly projectId: string;
		readonly itemUid: string;
		readonly expectedRevision: number;
		readonly force: boolean;
	}

	export interface DeleteResourceProps {
		readonly expectedRevision: number;
		readonly projectId: string;
		readonly resourceId: string;
	}

	export interface ReplaceConfigProps {
		readonly projectId: string;
		readonly expectedRevision: number;
		readonly config: GameConfigSchema.Type;
	}

	export interface ReplaceResourceProps {
		readonly config: GameConfigSchema.Type;
		readonly currentId: string;
		readonly expectedRevision: number;
		readonly projectId: string;
		readonly resource: ResourceSchema.Type;
	}

	export interface SaveResourceProps {
		readonly expectedRevision: number;
		readonly overwrite: boolean;
		readonly projectId: string;
		readonly resource: ResourceSchema.Type;
	}

	export interface UpsertResourcesProps {
		readonly projectId: string;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
	}

	export interface BoardScenarioKey {
		readonly projectId: string;
		readonly name: string;
	}

	export interface WriteBoardScenarioProps extends BoardScenarioKey {
		readonly expectedRevision: number;
		readonly bytes: Uint8Array;
	}

	export interface NoteKey {
		readonly projectId: string;
		readonly noteId: string;
	}

	export interface CreateNoteProps {
		readonly projectId: string;
		readonly content: string;
	}

	export interface DeleteNoteProps extends NoteKey {
		readonly expectedUpdatedAtMs: number;
	}

	export interface UpdateNoteProps extends NoteKey {
		readonly content: string;
		readonly expectedUpdatedAtMs: number;
	}
}

export interface ProjectRepositoryService extends ProjectVersionRepositoryService {
	/** Joins every repository write admitted before this Effect acquires the write boundary. */
	readonly awaitIdleFx: Effect.Effect<void, ProjectRepositoryError, never>;
	readonly createProjectFx: (
		props: ProjectRepository.CreateProjectProps,
	) => Effect.Effect<Project, ProjectRepositoryError, never>;
	readonly deleteProjectFx: (
		projectId: string,
	) => Effect.Effect<void, ProjectRepositoryError, never>;
	readonly createNoteFx: (
		props: ProjectRepository.CreateNoteProps,
	) => Effect.Effect<NoteSchema.Type, ProjectRepositoryError, never>;
	readonly deleteNoteFx: (
		props: ProjectRepository.DeleteNoteProps,
	) => Effect.Effect<void, ProjectRepositoryError, never>;
	readonly deleteItemFx: (
		props: ProjectRepository.DeleteItemProps,
	) => Effect.Effect<ProjectCommit, ProjectRepositoryError, never>;
	readonly deleteResourceFx: (
		props: ProjectRepository.DeleteResourceProps,
	) => Effect.Effect<Project, ProjectRepositoryError, never>;
	readonly listProjectsFx: Effect.Effect<
		ReadonlyArray<ProjectCandidate>,
		ProjectRepositoryError,
		never
	>;
	readonly listNotesFx: (
		projectId: string,
	) => Effect.Effect<ReadonlyArray<NoteSchema.Type>, ProjectRepositoryError, never>;
	readonly listBoardScenariosFx: (
		projectId: string,
	) => Effect.Effect<
		ReadonlyArray<BoardScenarioDescriptorSchema.Type>,
		ProjectRepositoryError,
		never
	>;
	readonly readBoardScenarioFx: (
		key: ProjectRepository.BoardScenarioKey,
	) => Effect.Effect<BoardScenarioSchema.Type | null, ProjectRepositoryError, never>;
	readonly readProjectFx: (
		projectId: string,
	) => Effect.Effect<Project | null, ProjectRepositoryError, never>;
	readonly replaceConfigFx: (
		props: ProjectRepository.ReplaceConfigProps,
	) => Effect.Effect<ProjectCommit, ProjectRepositoryError, never>;
	readonly replaceResourceFx: (
		props: ProjectRepository.ReplaceResourceProps,
	) => Effect.Effect<Project, ProjectRepositoryError, never>;
	readonly saveResourceFx: (
		props: ProjectRepository.SaveResourceProps,
	) => Effect.Effect<Project, ProjectRepositoryError, never>;
	readonly upsertItemFx: (
		props: ProjectRepository.UpsertItemProps,
	) => Effect.Effect<ProjectCommit, ProjectRepositoryError, never>;
	readonly upsertResourcesFx: (
		props: ProjectRepository.UpsertResourcesProps,
	) => Effect.Effect<Project, ProjectRepositoryError, never>;
	readonly updateNoteFx: (
		props: ProjectRepository.UpdateNoteProps,
	) => Effect.Effect<NoteSchema.Type, ProjectRepositoryError, never>;
	readonly writeBoardScenarioFx: (
		props: ProjectRepository.WriteBoardScenarioProps,
	) => Effect.Effect<BoardScenarioSchema.Type, ProjectRepositoryError, never>;
	readonly deleteBoardScenarioFx: (
		key: ProjectRepository.BoardScenarioKey,
	) => Effect.Effect<void, ProjectRepositoryError, never>;
}

/** Sole canonical persistence authority for editor projects. */
export class ProjectRepository extends Context.Service<
	ProjectRepository,
	ProjectRepositoryService
>()("EditorProjectRepository") {
	//
}

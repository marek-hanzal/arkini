import { Context, type Effect } from "effect";

import type { Project, ProjectCommit } from "~/project-authoring/type/Project";
import type { ProjectCandidate } from "~/project-authoring/schema/ProjectCandidateSchema";
import type { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { NoteSchema } from "~/project-note/schema/NoteSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { VersionPartsSchema } from "~/game-version/schema/VersionPartsSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";

export namespace ProjectRepository {
	export interface CreateProjectProps {
		readonly version: VersionPartsSchema.Type;
		readonly config: GameConfigSchema.Type;
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

	export interface OptimizeResourcesProps {
		readonly expectedRevision: number;
		readonly onProgressFn?: (progress: OptimizeResourcesProgress) => void;
		readonly projectId: string;
		readonly resourceIds: ReadonlyArray<IdSchema.Type>;
	}

	export interface OptimizeResourcesProgress {
		readonly completedResourceCount: number;
		readonly phase: "optimizing" | "saving";
		readonly totalResourceCount: number;
	}

	export interface OptimizeResourcesResult {
		readonly optimizedResourceCount: number;
		readonly originalBytes: number;
		readonly optimizedBytes: number;
		readonly processedResourceCount: number;
		readonly project: Project;
	}

	export interface NoteKey {
		readonly projectId: string;
		readonly noteId: string;
	}

	export interface CreateNoteProps {
		readonly projectId: string;
		readonly content: string;
		readonly itemUids: ReadonlyArray<string>;
		readonly resourceIds: ReadonlyArray<string>;
	}

	export interface DeleteNoteProps extends NoteKey {
		readonly expectedUpdatedAtMs: number;
	}

	export interface UpdateNoteProps extends NoteKey {
		readonly content: string;
		readonly itemUids: ReadonlyArray<string>;
		readonly resourceIds: ReadonlyArray<string>;
		readonly expectedUpdatedAtMs: number;
	}
}

export interface ProjectRepositoryService {
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
	readonly optimizeResourcesFx: (
		props: ProjectRepository.OptimizeResourcesProps,
	) => Effect.Effect<ProjectRepository.OptimizeResourcesResult, ProjectRepositoryError, never>;
	readonly listNotesFx: (
		projectId: string,
	) => Effect.Effect<ReadonlyArray<NoteSchema.Type>, ProjectRepositoryError, never>;
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
}

/** Sole canonical persistence authority for editor projects. */
export class ProjectRepository extends Context.Service<
	ProjectRepository,
	ProjectRepositoryService
>()("EditorProjectRepository") {
	//
}

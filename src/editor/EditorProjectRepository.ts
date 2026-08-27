import { Context, type Effect } from "effect";

import type { EditorProject, EditorProjectCommit } from "~/editor/EditorProject";
import type {
	EditorProjectBuildContentSchema,
	EditorProjectBuildSchema,
} from "~/editor/EditorProjectBuildSchema";
import type { EditorProjectCandidate } from "~/editor/EditorProjectCandidate";
import type { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import type { EditorNoteSchema } from "~/editor/note/EditorNoteSchema";
import type {
	EditorBoardScenarioDescriptorSchema,
	EditorBoardScenarioSchema,
} from "~/editor/board/EditorBoardScenarioSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import type { EditorProjectVersionRepositoryService } from "~/editor/version/EditorProjectVersion";

export namespace EditorProjectRepository {
	export interface CreateProjectProps {
		readonly version: ArkpackVersionSchema.Type;
		readonly config: GameConfigSchema.Type;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
	}

	export interface BuildProjectProps {
		readonly expectedRevision: number;
		readonly projectId: string;
	}

	export interface ReadProjectBuildProps {
		readonly contentHash: string;
		readonly expectedRevision: number;
		readonly projectId: string;
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

	export interface UpdateNoteProps extends NoteKey {
		readonly content: string;
	}
}

export interface EditorProjectRepositoryService extends EditorProjectVersionRepositoryService {
	/** Joins every repository write admitted before this Effect acquires the write boundary. */
	readonly awaitIdleFx: Effect.Effect<void, EditorProjectRepositoryError>;
	readonly buildProjectFx: (
		props: EditorProjectRepository.BuildProjectProps,
	) => Effect.Effect<EditorProjectBuildSchema.Type, EditorProjectRepositoryError>;
	readonly createProjectFx: (
		props: EditorProjectRepository.CreateProjectProps,
	) => Effect.Effect<EditorProject, EditorProjectRepositoryError>;
	readonly deleteProjectFx: (
		projectId: string,
	) => Effect.Effect<void, EditorProjectRepositoryError>;
	readonly createNoteFx: (
		props: EditorProjectRepository.CreateNoteProps,
	) => Effect.Effect<EditorNoteSchema.Type, EditorProjectRepositoryError>;
	readonly deleteNoteFx: (
		key: EditorProjectRepository.NoteKey,
	) => Effect.Effect<void, EditorProjectRepositoryError>;
	readonly deleteItemFx: (
		props: EditorProjectRepository.DeleteItemProps,
	) => Effect.Effect<EditorProjectCommit, EditorProjectRepositoryError>;
	readonly deleteResourceFx: (
		props: EditorProjectRepository.DeleteResourceProps,
	) => Effect.Effect<EditorProject, EditorProjectRepositoryError>;
	readonly listProjectsFx: Effect.Effect<
		ReadonlyArray<EditorProjectCandidate>,
		EditorProjectRepositoryError
	>;
	readonly listNotesFx: (
		projectId: string,
	) => Effect.Effect<ReadonlyArray<EditorNoteSchema.Type>, EditorProjectRepositoryError>;
	readonly listBoardScenariosFx: (
		projectId: string,
	) => Effect.Effect<
		ReadonlyArray<EditorBoardScenarioDescriptorSchema.Type>,
		EditorProjectRepositoryError
	>;
	readonly readBoardScenarioFx: (
		key: EditorProjectRepository.BoardScenarioKey,
	) => Effect.Effect<EditorBoardScenarioSchema.Type | null, EditorProjectRepositoryError>;
	readonly readProjectFx: (
		projectId: string,
	) => Effect.Effect<EditorProject | null, EditorProjectRepositoryError>;
	readonly readProjectBuildFx: (
		props: EditorProjectRepository.ReadProjectBuildProps,
	) => Effect.Effect<EditorProjectBuildContentSchema.Type, EditorProjectRepositoryError>;
	readonly replaceConfigFx: (
		props: EditorProjectRepository.ReplaceConfigProps,
	) => Effect.Effect<EditorProjectCommit, EditorProjectRepositoryError>;
	readonly replaceResourceFx: (
		props: EditorProjectRepository.ReplaceResourceProps,
	) => Effect.Effect<EditorProject, EditorProjectRepositoryError>;
	readonly saveResourceFx: (
		props: EditorProjectRepository.SaveResourceProps,
	) => Effect.Effect<EditorProject, EditorProjectRepositoryError>;
	readonly upsertItemFx: (
		props: EditorProjectRepository.UpsertItemProps,
	) => Effect.Effect<EditorProjectCommit, EditorProjectRepositoryError>;
	readonly upsertResourcesFx: (
		props: EditorProjectRepository.UpsertResourcesProps,
	) => Effect.Effect<EditorProject, EditorProjectRepositoryError>;
	readonly updateNoteFx: (
		props: EditorProjectRepository.UpdateNoteProps,
	) => Effect.Effect<EditorNoteSchema.Type, EditorProjectRepositoryError>;
	readonly writeBoardScenarioFx: (
		props: EditorProjectRepository.WriteBoardScenarioProps,
	) => Effect.Effect<EditorBoardScenarioSchema.Type, EditorProjectRepositoryError>;
	readonly deleteBoardScenarioFx: (
		key: EditorProjectRepository.BoardScenarioKey,
	) => Effect.Effect<void, EditorProjectRepositoryError>;
}

/** Sole canonical persistence authority for editor projects. */
export class EditorProjectRepository extends Context.Service<
	EditorProjectRepository,
	EditorProjectRepositoryService
>()("EditorProjectRepository") {
	//
}

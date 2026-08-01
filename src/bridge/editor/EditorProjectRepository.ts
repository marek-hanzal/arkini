import { Context, type Effect } from "effect";

import type { EditorProject, EditorProjectCommit } from "~/bridge/editor/EditorProject";
import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import type { EditorProjectRepositoryError } from "~/bridge/editor/EditorProjectRepositoryError";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";

export namespace EditorProjectRepository {
	export interface CreateProjectProps {
		readonly projectId: string;
		readonly config: GameConfigSchema.Type;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
	}

	export interface UpsertItemProps {
		readonly projectId: string;
		readonly item: ItemSchema.Type;
	}

	export interface ReplaceConfigProps {
		readonly projectId: string;
		readonly config: GameConfigSchema.Type;
	}

	export interface ReplaceResourceProps {
		readonly config: GameConfigSchema.Type;
		readonly currentId: string;
		readonly projectId: string;
		readonly resource: ResourceSchema.Type;
	}

	export interface UpsertResourcesProps {
		readonly projectId: string;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
	}
}

export interface EditorProjectRepositoryService {
	/** Joins every repository write admitted before this Effect acquires the write boundary. */
	readonly awaitIdleFx: Effect.Effect<void>;
	readonly createProjectFx: (
		props: EditorProjectRepository.CreateProjectProps,
	) => Effect.Effect<EditorProject, EditorProjectRepositoryError>;
	readonly listProjectsFx: Effect.Effect<
		ReadonlyArray<EditorProjectDescriptor>,
		EditorProjectRepositoryError
	>;
	readonly readProjectFx: (
		projectId: string,
	) => Effect.Effect<EditorProject | null, EditorProjectRepositoryError>;
	readonly replaceConfigFx: (
		props: EditorProjectRepository.ReplaceConfigProps,
	) => Effect.Effect<EditorProjectCommit, EditorProjectRepositoryError>;
	readonly replaceResourceFx: (
		props: EditorProjectRepository.ReplaceResourceProps,
	) => Effect.Effect<EditorProject, EditorProjectRepositoryError>;
	readonly upsertItemFx: (
		props: EditorProjectRepository.UpsertItemProps,
	) => Effect.Effect<EditorProjectCommit, EditorProjectRepositoryError>;
	readonly upsertResourcesFx: (
		props: EditorProjectRepository.UpsertResourcesProps,
	) => Effect.Effect<EditorProject, EditorProjectRepositoryError>;
}

/** Sole canonical persistence authority for editor projects in the renderer process. */
export class EditorProjectRepository extends Context.Service<
	EditorProjectRepository,
	EditorProjectRepositoryService
>()("EditorProjectRepository") {
	//
}

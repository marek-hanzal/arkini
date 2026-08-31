import type { Effect, SubscriptionRef } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { EditorBoardGame } from "~/board-scenario/type/EditorBoardGame";
import type { GameEngineResource } from "~/playable-game/type/GameEngineResource";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";

export namespace EditorBoardGameResource {
	export type Resource = GameEngineResource<EditorBoardGame>;
	export type State =
		| {
				readonly type: "idle";
		  }
		| {
				readonly type: "loading";
				readonly projectId: string;
				readonly projectRevision: number;
		  }
		| {
				readonly type: "ready";
				readonly resource: Resource;
		  }
		| {
				readonly type: "failed";
				readonly error: unknown;
				readonly projectId: string;
				readonly projectRevision: number;
		  };
}

/** Process-owned, serialized lifecycle for the revision-pinned editor game. */
export interface EditorBoardGameResource {
	readonly state: SubscriptionRef.SubscriptionRef<EditorBoardGameResource.State>;
	/** Claims the routed project before synchronizing its latest loaded revision. */
	readonly syncFx: (project: Project) => Effect.Effect<void>;
	/** Synchronizes a committed revision only while its project still owns the route. */
	readonly publishFx: (project: Project) => Effect.Effect<void>;
	/** Replaces the current same-revision session after an explicit scenario selection. */
	readonly replaceFx: (
		project: Project,
		state?: StateSchema.Type,
	) => Effect.Effect<void, unknown>;
	readonly releaseCurrentFx: Effect.Effect<void, unknown>;
	readonly shutdownFx: Effect.Effect<void>;
}

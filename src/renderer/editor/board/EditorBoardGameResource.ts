import type { Effect, SubscriptionRef } from "effect";

import type { EditorProject } from "~/editor/EditorProject";
import type { EditorBoardGame } from "~/renderer/editor/board/EditorBoardGame";
import type { GameEngineResource } from "~/renderer/game/resource/GameEngineResource";
import type { StateSchema } from "~/engine/state/schema/StateSchema";

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
	readonly syncFx: (project: EditorProject) => Effect.Effect<void>;
	/** Synchronizes a committed revision only while its project still owns the route. */
	readonly publishFx: (project: EditorProject) => Effect.Effect<void>;
	/** Replaces the current same-revision session after an explicit scenario selection. */
	readonly replaceFx: (
		project: EditorProject,
		state?: StateSchema.Type,
	) => Effect.Effect<void, unknown>;
	readonly releaseCurrentFx: Effect.Effect<void, unknown>;
	readonly shutdownFx: Effect.Effect<void>;
}

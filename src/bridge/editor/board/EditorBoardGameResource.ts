import type { Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorBoardGame } from "~/bridge/editor/board/EditorBoardGame";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";

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
	readonly releaseCurrentFx: Effect.Effect<void, unknown>;
	readonly shutdownFx: Effect.Effect<void>;
}

/** Configured process owner used by bridge commands and the React state projection. */
export const EditorBoardGameResourceOwnerAtom = Atom.make<EditorBoardGameResource | undefined>(
	undefined,
).pipe(Atom.keepAlive);

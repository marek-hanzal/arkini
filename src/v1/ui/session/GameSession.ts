import type { Effect } from "effect";
import type * as LayerModule from "effect/Layer";

import type { GameEventBatchSchema } from "~/v1/event/schema/GameEventBatchSchema";
import type { GameSessionLayerFx } from "~/v1/game/layer/GameSessionLayerFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { RuntimeSaveFx } from "~/v1/ui/save/RuntimeSaveFx";

export type GameSessionServices =
	| LayerModule.Layer.Success<ReturnType<typeof GameSessionLayerFx>>
	| RuntimeSaveFx;

/** Stable browser-facing owner of one loaded game's Effect services and resources. */
export interface GameSession {
	readonly dispose: () => Promise<void>;
	/** Destructive-reset shutdown; use only before deleting persisted state. */
	readonly disposeWithoutSave: () => Promise<void>;
	readonly flushSave: () => Promise<void>;
	readonly getSnapshot: () => RuntimeSchema.Type;
	readonly run: <Result, Error, Requirements extends GameSessionServices>(
		effect: Effect.Effect<Result, Error, Requirements>,
	) => Promise<Result>;
	readonly subscribe: (listener: () => void | PromiseLike<void>) => () => void;
	readonly subscribeEvents: (
		listener: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>,
	) => () => void;
}

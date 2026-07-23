import type { Effect, Exit } from "effect";
import type * as LayerModule from "effect/Layer";

import type { GameEventBatchSchema } from "~/engine/event/schema/GameEventBatchSchema";
import type { GameSessionLayerFx } from "~/engine/game/layer/GameSessionLayerFx";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { RuntimeSaveFx } from "~/bridge/save/RuntimeSaveFx";

export type GameSessionServices =
	| LayerModule.Layer.Success<ReturnType<typeof GameSessionLayerFx>>
	| RuntimeSaveFx;

/** Stable renderer-facing owner of one loaded game's Effect services and resources. */
export interface GameSession {
	/** Saves and releases the session; a failed final save leaves it frozen and retryable. */
	readonly disposeFx: Effect.Effect<void, unknown>;
	/** Destructive disposal for hard reset or an unpublished bootstrap. */
	readonly disposeWithoutSaveFx: Effect.Effect<void, unknown>;
	readonly flushSaveFx: Effect.Effect<void, unknown>;
	readonly getSnapshot: () => RuntimeSchema.Type;
	/** Latest exact runtime plus the ordered facts and bounded outgoing snapshot for that commit. */
	readonly getTransitionSnapshot: () => CommittedTransitionSchema.Type;
	/** Claims one committed sequence for the single tile-presentation lifetime of this Game. */
	readonly claimTilePresentationTransition: (sequence: number) => boolean;
	/** Executes one synchronous live read inside this Game's existing session runtime. */
	readonly read: <Result, Error, Requirements extends GameSessionServices>(
		effect: Effect.Effect<Result, Error, Requirements>,
	) => Exit.Exit<Result, Error | unknown>;
	readonly run: <Result, Error, Requirements extends GameSessionServices>(
		effect: Effect.Effect<Result, Error, Requirements>,
	) => Promise<Result>;
	readonly subscribe: (listener: () => void | PromiseLike<void>) => () => void;
	/** Replays the atomically captured current transition, then every later commit in order. */
	readonly subscribeTransitions: (
		listener: (transition: CommittedTransitionSchema.Type) => void | PromiseLike<void>,
	) => () => void;
	readonly subscribeEvents: (
		listener: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>,
	) => () => void;
}

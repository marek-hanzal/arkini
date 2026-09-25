import type { Effect } from "effect";

import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { AnimationCurve } from "~/tile-rendering/service/AnimationDriver";

export type AnimationChannel =
	| "artwork-color"
	| "artwork-opacity"
	| "drop-target"
	| "grab-offset"
	| "hover-scale"
	| "lifecycle-opacity"
	| "lifecycle-scale"
	| "pose";

interface AnimationBase {
	readonly actor: PixiTileActor;
	readonly curve?: AnimationCurve;
	readonly delayMs?: number;
	readonly durationMs: number;
	readonly onCancelFn?: () => void;
	readonly onCompleteFn?: () => void;
	readonly ownerKey?: string;
	readonly repeat?: number;
}

export interface PresentedPose {
	readonly scale?: number;
	readonly x: number;
	readonly y: number;
}

export type ActorAnimation =
	| (AnimationBase & {
			readonly channel: "artwork-color";
			readonly toFraction: number;
	  })
	| (AnimationBase & {
			readonly channel: "artwork-opacity";
	  })
	| (AnimationBase & {
			readonly channel: "drop-target";
			readonly toFactor: number;
	  })
	| (AnimationBase & {
			readonly channel: "hover-scale";
			readonly toScale: number;
	  })
	| (AnimationBase & {
			readonly channel: "pose";
			readonly readPoseFn?: (progress: number) => PresentedPose;
			readonly toScale?: number;
			readonly toX?: number;
			readonly toY?: number;
	  })
	| (AnimationBase & {
			readonly channel: "lifecycle-opacity";
			readonly toAlpha: number;
	  })
	| (AnimationBase & {
			readonly channel: "lifecycle-scale";
			readonly toScale: number;
	  });

export type PresentationWrite =
	| {
			readonly actor: PixiTileActor;
			readonly channel: "drop-target";
			readonly factor: number;
	  }
	| {
			readonly actor: PixiTileActor;
			readonly alpha: number;
			readonly channel: "lifecycle-opacity";
	  }
	| {
			readonly actor: PixiTileActor;
			readonly channel: "lifecycle-scale";
			readonly scale: number;
	  }
	| {
			readonly actor: PixiTileActor;
			readonly channel: "hover-scale";
			readonly scale: number;
	  }
	| {
			readonly actor: PixiTileActor;
			readonly channel: "grab-offset";
			readonly pivotX: number;
			readonly pivotY: number;
	  }
	| {
			readonly actor: PixiTileActor;
			readonly channel: "pose";
			readonly scale?: number;
			readonly x: number;
			readonly y: number;
	  };

export interface ActorAnimator {
	readonly animateFx: (animation: ActorAnimation) => Effect.Effect<void, never, never>;
	readonly cancelActorFx: (actor: PixiTileActor) => Effect.Effect<void, never, never>;
	readonly cancelChannelFx: (
		actor: PixiTileActor,
		channel: AnimationChannel,
	) => Effect.Effect<void, never, never>;
	readonly cancelFx: (ownerKey: string) => Effect.Effect<void, never, never>;
	readonly isChannelActiveFx: (
		actor: PixiTileActor,
		channel: AnimationChannel,
	) => Effect.Effect<boolean, never, never>;
	readonly setFx: (write: PresentationWrite) => Effect.Effect<void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}

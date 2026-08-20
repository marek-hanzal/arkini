import type { Effect } from "effect";
import type { Container } from "pixi.js";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiAnimationCurve } from "~/ui/pixi/animation/PixiAnimationDriver";

export type PixiActorAnimationChannel =
	| "activity-particles"
	| "crowd-opacity"
	| "grab-offset"
	| "lifecycle-opacity"
	| "lifecycle-scale"
	| "pose"
	| "visual-mix";

interface PixiActorAnimationBase {
	readonly actor: PixiTileActor;
	readonly curve?: PixiAnimationCurve;
	readonly delayMs?: number;
	readonly durationMs: number;
	readonly onCancel?: () => void;
	readonly onComplete?: () => void;
	readonly ownerKey?: string;
	readonly repeat?: number;
}

export interface PixiActorPresentedPose {
	readonly scale?: number;
	readonly x: number;
	readonly y: number;
}

export type PixiActorAnimation =
	| (PixiActorAnimationBase & {
			readonly channel: "pose";
			readonly readPose?: (progress: number) => PixiActorPresentedPose;
			readonly toScale?: number;
			readonly toX?: number;
			readonly toY?: number;
	  })
	| (PixiActorAnimationBase & {
			readonly channel: "lifecycle-opacity";
			readonly toAlpha: number;
	  })
	| (PixiActorAnimationBase & {
			readonly channel: "lifecycle-scale";
			readonly toScale: number;
	  })
	| (PixiActorAnimationBase & {
			readonly channel: "crowd-opacity";
			readonly toCrowdAlpha: number;
	  })
	| (PixiActorAnimationBase & {
			readonly channel: "activity-particles";
			readonly render: (progress: number) => void;
	  })
	| (PixiActorAnimationBase & {
			readonly channel: "visual-mix";
			readonly incoming: Container;
			readonly outgoing: Container;
	  });

export type PixiActorPresentationWrite =
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
			readonly alpha: number;
			readonly channel: "crowd-opacity";
	  }
	| {
			readonly actor: PixiTileActor;
			readonly channel: "grab-offset";
			readonly pivotX: number;
			readonly pivotY: number;
	  }
	| {
			readonly actor: PixiTileActor;
			readonly channel: "activity-particles";
			readonly reset?: boolean;
			readonly visible: boolean;
	  }
	| {
			readonly actor: PixiTileActor;
			readonly channel: "pose";
			readonly scale?: number;
			readonly x: number;
			readonly y: number;
	  };

export interface PixiActorAnimator {
	readonly animateFx: (animation: PixiActorAnimation) => Effect.Effect<void>;
	readonly cancelActorFx: (actor: PixiTileActor) => Effect.Effect<void>;
	readonly cancelChannelFx: (
		actor: PixiTileActor,
		channel: PixiActorAnimationChannel,
	) => Effect.Effect<void>;
	readonly cancelFx: (ownerKey: string) => Effect.Effect<void>;
	readonly isChannelActiveFx: (
		actor: PixiTileActor,
		channel: PixiActorAnimationChannel,
	) => Effect.Effect<boolean>;
	readonly setFx: (write: PixiActorPresentationWrite) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}

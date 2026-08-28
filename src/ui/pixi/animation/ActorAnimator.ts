import type { Effect } from "effect";
import type { Container } from "pixi.js";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { AnimationCurve } from "~/ui/pixi/animation/AnimationDriver";

export type AnimationChannel =
	| "activity-particles"
	| "crowd-opacity"
	| "grab-offset"
	| "lifecycle-opacity"
	| "lifecycle-scale"
	| "pose"
	| "visual-mix";

interface AnimationBase {
	readonly actor: PixiTileActor;
	readonly curve?: AnimationCurve;
	readonly delayMs?: number;
	readonly durationMs: number;
	readonly onCancel?: () => void;
	readonly onComplete?: () => void;
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
			readonly channel: "pose";
			readonly readPose?: (progress: number) => PresentedPose;
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
	  })
	| (AnimationBase & {
			readonly channel: "crowd-opacity";
			readonly toCrowdAlpha: number;
	  })
	| (AnimationBase & {
			readonly channel: "activity-particles";
			readonly render: (progress: number) => void;
	  })
	| (AnimationBase & {
			readonly channel: "visual-mix";
			readonly incoming: Container;
			readonly outgoing: Container;
	  });

export type PresentationWrite =
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

export interface ActorAnimator {
	readonly animateFx: (animation: ActorAnimation) => Effect.Effect<void>;
	readonly cancelActorFx: (actor: PixiTileActor) => Effect.Effect<void>;
	readonly cancelChannelFx: (
		actor: PixiTileActor,
		channel: AnimationChannel,
	) => Effect.Effect<void>;
	readonly cancelFx: (ownerKey: string) => Effect.Effect<void>;
	readonly isChannelActiveFx: (
		actor: PixiTileActor,
		channel: AnimationChannel,
	) => Effect.Effect<boolean>;
	readonly setFx: (write: PresentationWrite) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}

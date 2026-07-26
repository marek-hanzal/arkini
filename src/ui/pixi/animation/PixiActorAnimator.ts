import type { Effect } from "effect";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

export interface PixiActorAnimation {
	readonly actor: PixiTileActor;
	readonly animationKey?: string;
	readonly delayMs?: number;
	readonly durationMs: number;
	readonly onComplete?: () => void;
	readonly toAlpha?: number;
	readonly toCrowdAlpha?: number;
	readonly toScale?: number;
	readonly toX?: number;
	readonly toY?: number;
}

export interface PixiActorAnimator {
	readonly animateFx: (animation: PixiActorAnimation) => Effect.Effect<void>;
	readonly cancelFx: (animationKey: string) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}

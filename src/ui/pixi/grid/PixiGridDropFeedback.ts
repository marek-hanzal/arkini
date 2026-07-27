import type { Effect } from "effect";
import type { Container } from "pixi.js";

import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

export interface PixiGridDropFeedback {
	readonly container: Container;
	readonly closeFx: Effect.Effect<void>;
	readonly renderFx: (props: {
		readonly color: number;
		readonly slot: {
			readonly x: number;
			readonly y: number;
		} | null;
		readonly surface: PixiGridSurfaceLayout | null;
	}) => Effect.Effect<void>;
}

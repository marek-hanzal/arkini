import type { Effect } from "effect";
import type { Container } from "pixi.js";

import type { SurfaceLayout } from "~/ui/pixi/layout/SceneLayout";

export interface DropFeedback {
	readonly container: Container;
	readonly closeFx: Effect.Effect<void>;
	readonly renderFx: (props: {
		readonly color: number;
		readonly slot: {
			readonly x: number;
			readonly y: number;
		} | null;
		readonly surface: SurfaceLayout | null;
	}) => Effect.Effect<void>;
}

import type { Application, Container } from "pixi.js";
import type { Effect } from "effect";

import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";

export interface PixiApplicationOwner {
	readonly app: Application;
	readonly stage: Container;
	readonly frames: DemandFrameLoop;
	readonly addResizeListenerFx: (listener: () => void) => Effect.Effect<() => void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}

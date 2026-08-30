import type { Container } from "pixi.js";

export interface ActorPose {
	readonly layer: Container;
	readonly size: number;
	readonly x: number;
	readonly y: number;
}

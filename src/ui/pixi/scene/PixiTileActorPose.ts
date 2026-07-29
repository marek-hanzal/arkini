import type { Container } from "pixi.js";

export interface PixiTileActorPose {
	readonly layer: Container;
	readonly height: number;
	readonly size: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

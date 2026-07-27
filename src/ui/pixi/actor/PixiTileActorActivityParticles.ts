import type { Particle, ParticleContainer } from "pixi.js";

export interface PixiTileActorActivityParticle {
	readonly alphaScale: number;
	readonly phaseOffset: number;
	readonly particle: Particle;
	readonly spreadOffset: number;
	readonly waveOffset: number;
}

export interface PixiTileActorActivityParticles {
	readonly container: ParticleContainer<Particle>;
	readonly particles: readonly PixiTileActorActivityParticle[];
	centerX: number;
	feedbackPhase: "burst" | "draining" | null;
	lastProgress: number;
	startY: number;
	topHalfWidth: number;
	topY: number;
	workingTint: number;
}

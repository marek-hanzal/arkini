import type { Particle, ParticleContainer } from "pixi.js";

interface ParticleState {
	readonly alphaScale: number;
	readonly phaseOffset: number;
	readonly particle: Particle;
	readonly spreadOffset: number;
	readonly speedCycles: number;
	readonly waveOffset: number;
}

export interface ActivityParticles {
	readonly container: ParticleContainer<Particle>;
	readonly particles: readonly ParticleState[];
	centerX: number;
	feedbackPhase: "burst" | "draining" | null;
	lastProgress: number;
	lightSurface: boolean;
	startY: number;
	topHalfWidth: number;
	topY: number;
	workingTint: number;
}

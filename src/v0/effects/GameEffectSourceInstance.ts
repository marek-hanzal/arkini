import type { GameEffect } from "~/config/readGameConfigEffects";

export interface GameEffectSourceInstance {
	effect: GameEffect;
	effectId: string;
	kind: "active" | "passive";
	sourceCreatedAtMs?: number;
	sourceId: string;
	sourceItemInstanceId: string;
	sourceLocation: "board" | "inventory";
	startAtMs: number;
}

export interface GameEffectSourceInstance {
	activatedAtMs: number;
	effectId: string;
	kind: "active" | "passive";
	sourceId: string;
	sourceItemInstanceId: string;
}

export interface GameEffectSourceInstance {
	startAtMs: number;
	effectId: string;
	kind: "active" | "passive";
	sourceId: string;
	sourceItemInstanceId: string;
	sourceLocation: "board" | "inventory";
}

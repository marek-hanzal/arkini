export interface GameEffectSourceInstance {
	startAtMs: number;
	effectId: string;
	kind: "active" | "passive";
	sourceId: string;
	sourceCreatedAtMs?: number;
	sourceItemInstanceId: string;
	sourceLocation: "board" | "inventory";
}

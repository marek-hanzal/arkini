export interface BlockedGameEffectOperation {
	effectId: string;
	effectName: string;
	kind: "item.blockCreate";
	reason?: string;
	sourceId: string;
	sourceItemInstanceId?: string;
	targetItemId: string;
}

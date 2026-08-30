export type TileActorFeedbackCue = {
	readonly actorId: string;
	readonly key: string;
	readonly kind: "consume" | "consume-source" | "replacement" | "resource-spent";
};

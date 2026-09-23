/** Immutable visual facts needed to retain one tile face across transitions. */
export interface TileActorVisual {
	readonly itemUid: string;
	readonly artworkScale: number;
	readonly sourceUrl: string;
	readonly compositeUrl?: string;
}

/** Immutable visual facts needed to retain one tile face across transitions. */
export interface TileActorVisual {
	readonly itemId: string;
	readonly artworkScale: number;
	readonly title: string;
	readonly sourceUrl: string;
	readonly compositeUrl?: string;
}

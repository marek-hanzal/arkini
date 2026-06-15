export interface DraggablePayload<
	ItemId extends string = string,
	Source = unknown,
	Overlay = unknown,
> {
	/** Stable key of the visual source. Used only for hiding/showing DOM during committed state. */
	sourceId: string;
	/** Node measured when a rejected drop flies back. */
	sourceNodeId: string;
	/** Asset/item key used by the app-provided animation renderer. */
	itemId: ItemId;
	/** App-owned source data. The control never inspects it. */
	source: Source;
	/** Extra app-owned overlay data. The control never inspects it. */
	overlay?: Overlay;
	/** Multi-stack sources can stay visible while dragged; single visual objects usually hide. */
	hideWhenActive?: boolean;
}

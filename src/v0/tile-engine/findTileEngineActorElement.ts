export const findTileEngineActorElement = ({
	sourceElement,
	tileId,
}: {
	sourceElement: HTMLElement;
	tileId: string;
}) =>
	sourceElement
		.closest("[data-ak-tile-engine-id]")
		?.querySelector<HTMLElement>(`[data-ak-tile-engine-tile-id="${CSS.escape(tileId)}"]`) ??
	null;

export namespace TilePresenceMotionMarker {
	export interface CreateTokenProps {
		kind: "enter" | "exit";
		groupId?: string;
		tileId: string;
	}
}

export const createTilePresenceMotionToken = ({
	groupId,
	kind,
	tileId,
}: TilePresenceMotionMarker.CreateTokenProps) =>
	[
		kind,
		tileId,
		groupId ?? "ungrouped",
		Math.round(performance.now() * 100),
	].join(":");

export const markTilePresenceMotion = (element: HTMLElement, token: string) => {
	element.dataset.akTileEnginePresenceMotion = token;

	return () => {
		if (element.dataset.akTileEnginePresenceMotion !== token) return;
		delete element.dataset.akTileEnginePresenceMotion;
	};
};

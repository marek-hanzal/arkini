export namespace TilePresenceMotionMarker {
	export interface CreateTokenProps {
		kind: "enter" | "exit";
		groupId?: string;
		tileId: string;
	}
}

let presenceMotionSequence = 0;

export const createTilePresenceMotionToken = ({
	groupId,
	kind,
	tileId,
}: TilePresenceMotionMarker.CreateTokenProps) =>
	[
		kind,
		tileId,
		groupId ?? "ungrouped",
		++presenceMotionSequence,
	].join(":");

export const markTilePresenceMotion = (element: HTMLElement, token: string) => {
	element.dataset.akTileEnginePresenceMotion = token;

	return () => {
		if (element.dataset.akTileEnginePresenceMotion !== token) return;
		delete element.dataset.akTileEnginePresenceMotion;
	};
};

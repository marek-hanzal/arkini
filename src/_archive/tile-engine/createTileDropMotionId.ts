let dropMotionSequence = 0;

export const createTileDropMotionId = ({
	pointerId,
	sourceTileId,
}: {
	pointerId: number;
	sourceTileId: string;
}) => `drop:${sourceTileId}:${pointerId}:${++dropMotionSequence}`;

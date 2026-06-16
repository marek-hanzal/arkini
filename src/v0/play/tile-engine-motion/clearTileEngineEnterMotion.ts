import type { TileEngineMotionSchema } from "~/v0/tile-engine/TileEngineMotionSchema";

export const clearTileEngineEnterMotion = (
	motion: TileEngineMotionSchema.Type | undefined,
	groupId: string,
): TileEngineMotionSchema.Type | undefined => {
	if (motion?.enter?.groupId !== groupId) return motion;
	if (motion.exit) {
		return {
			...motion,
			enter: undefined,
		};
	}
	return undefined;
};

import type { TileVisualSnapshot } from "~/tile-engine/TileVisualSnapshot";
import type { TileMotionRuntime } from "~/tile-engine/TileMotionRuntimeTypes";

export const resolveTileMotionValue = (
	value: string | ((snapshot: TileVisualSnapshot.Type) => string),
	snapshot: TileVisualSnapshot.Type,
) => (typeof value === "function" ? value(snapshot) : value);

export const resolveTileMotionKeyframes = (
	keyframes:
		| TileMotionRuntime.StyleKeyframes
		| ((snapshot: TileVisualSnapshot.Type) => TileMotionRuntime.StyleKeyframes),
	snapshot: TileVisualSnapshot.Type,
) => (typeof keyframes === "function" ? keyframes(snapshot) : keyframes);

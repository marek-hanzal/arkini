import { isSameGridLocation } from "~/engine/location/read/isSameGridLocation";
import type { TileLocation } from "~/bridge/tile/TileLocation";

/** Compares two public tile locations without exposing engine helpers to reusable UI. */
export const isSameTileLocation = (left: TileLocation, right: TileLocation) =>
	isSameGridLocation(left, right);

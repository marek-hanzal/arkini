import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

/** Public bridge shape for one exact grid-backed tile location. */
export type TileLocation = GridLocationSchema.Type;

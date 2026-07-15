import type { SpeedModeSchema } from "~/v1/session/schema/SpeedModeSchema";

/** Converts newly observed wall-clock milliseconds into simulation milliseconds. */
export const SpeedModeMultiplier = {
	normal: 1,
	accelerated: 30,
} as const satisfies Record<SpeedModeSchema.Type, number>;

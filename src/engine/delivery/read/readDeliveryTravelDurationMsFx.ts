import { Effect } from "effect";

import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { TickStepMs } from "~/engine/tick/TickStepMs";

export namespace readDeliveryTravelDurationMsFx {
	export interface Props {
		readonly from: GridLocationSchema.Type;
		readonly to: GridLocationSchema.Type;
	}
}

const minimumSameSurfaceDurationMs = 300;
const millisecondsPerTile = 120;
const crossSurfaceDurationMs = 500;

const isSameSurface = (from: GridLocationSchema.Type, to: GridLocationSchema.Type) =>
	from.scope === to.scope &&
	(from.scope !== LocationScopeEnumSchema.enum.Board ||
		(to.scope === LocationScopeEnumSchema.enum.Board && from.space === to.space));

/** Derives one deterministic engine-owned delivery duration from canonical grid facts. */
export const readDeliveryTravelDurationMsFx = Effect.fn("readDeliveryTravelDurationMsFx")(
	({ from, to }: readDeliveryTravelDurationMsFx.Props) =>
		Effect.sync(() => {
			if (!isSameSurface(from, to)) return crossSurfaceDurationMs;
			const distance = Math.hypot(
				to.position.x - from.position.x,
				to.position.y - from.position.y,
			);
			const duration = Math.max(minimumSameSurfaceDurationMs, distance * millisecondsPerTile);
			return Math.ceil(duration / TickStepMs) * TickStepMs;
		}),
);

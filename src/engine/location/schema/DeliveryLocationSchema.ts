import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { DeliveryPhaseEnumSchema } from "~/engine/delivery/schema/DeliveryPhaseEnumSchema";
import { DeliveryPurposeSchema } from "~/engine/delivery/schema/DeliveryPurposeSchema";
import { LineInputDeliveryTargetSchema } from "~/engine/delivery/schema/LineInputDeliveryTargetSchema";
import { GridLocationSchema } from "./GridLocationSchema";
import { LocationScopeEnumSchema } from "./LocationScopeEnumSchema";

/**
 * One live item physically travelling between a retained grid origin and a semantic target.
 *
 * The origin is a canonical return lease until the item either fully commits at its target or
 * returns home. `generation` invalidates stale presentation completions after redirects or
 * preemption without exporting renderer lifecycle into gameplay state.
 */
const DeliveryLocationBaseSchema = z.object({
	scope: LocationScopeEnumSchema.extract([
		"Delivery",
	]),
	generation: NonNegativeIntegerSchema.describe(
		"The monotonically increasing completion generation of this delivery.",
	),
	origin: GridLocationSchema.describe(
		"The exact grid cell leased until this delivery no longer needs to return.",
	),
	purpose: DeliveryPurposeSchema,
});

export const DeliveryLocationSchema = z
	.discriminatedUnion("phase", [
		DeliveryLocationBaseSchema.extend({
			phase: DeliveryPhaseEnumSchema.extract([
				"Outbound",
			]),
			target: LineInputDeliveryTargetSchema,
		}).strict(),
		DeliveryLocationBaseSchema.extend({
			phase: DeliveryPhaseEnumSchema.extract([
				"Returning",
			]),
			returnFrom: GridLocationSchema.describe(
				"The semantic location from which return motion is reconstructed after hydration.",
			),
		}).strict(),
	])
	.meta({
		id: "DeliveryLocationSchema",
		description: "One canonical outbound or returning runtime-item delivery.",
	});

export type DeliveryLocationSchema = typeof DeliveryLocationSchema;

export namespace DeliveryLocationSchema {
	export type Type = z.infer<DeliveryLocationSchema>;
}

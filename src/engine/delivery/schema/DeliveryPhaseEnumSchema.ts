import { z } from "zod";

/** The canonical direction of one live delivery item. */
export const DeliveryPhaseEnumSchema = z
	.enum({
		Outbound: "outbound",
		Returning: "returning",
	})
	.meta({
		id: "DeliveryPhaseEnumSchema",
		description: "Whether one delivery is approaching its target or returning to its origin.",
	});

export type DeliveryPhaseEnumSchema = typeof DeliveryPhaseEnumSchema;

export namespace DeliveryPhaseEnumSchema {
	export type Type = z.infer<DeliveryPhaseEnumSchema>;
}

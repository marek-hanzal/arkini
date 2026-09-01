import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";

/** Renders one authored exact or ranged quantity with canonical Editor punctuation. */
export const QuantityValue = ({ quantity }: { readonly quantity: QuantitySchema.Type }) => (
	<>{quantity.min === quantity.max ? quantity.min : `${quantity.min}–${quantity.max}`}</>
);

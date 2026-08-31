import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";

/** Presents one authored item selector in editor detail copy. */
export const SelectorDetail = ({ selector }: { readonly selector: SelectorSchema.Type }) => (
	<>Item {selector.itemId}</>
);

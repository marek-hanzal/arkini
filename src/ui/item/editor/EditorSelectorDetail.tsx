import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

/** Presents one authored item selector in editor detail copy. */
export const EditorSelectorDetail = ({ selector }: { readonly selector: SelectorSchema.Type }) => (
	<>Item {selector.itemId}</>
);

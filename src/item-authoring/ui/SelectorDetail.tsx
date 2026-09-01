import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import { DetailReference } from "~/item-authoring/ui/DetailReference";

/** Presents one authored item selector in editor detail copy. */
export const SelectorDetail = ({ selector }: { readonly selector: SelectorSchema.Type }) => (
	<DetailReference itemId={selector.itemId} />
);

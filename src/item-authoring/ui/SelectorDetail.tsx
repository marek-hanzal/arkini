import type { ReactNode } from "react";
import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import { DetailReference } from "~/item-authoring/ui/DetailReference";

/** Presents one authored item selector in editor detail copy. */
export const SelectorDetail = ({
	selector,
	description,
	eyebrow,
}: {
	readonly selector: SelectorSchema.Type;
	readonly description?: ReactNode;
	readonly eyebrow?: ReactNode;
}) => (
	<DetailReference
		itemUid={selector.itemUid}
		eyebrow={eyebrow}
		description={description}
	/>
);

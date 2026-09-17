import type { ReactNode } from "react";
import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import { DetailReference } from "~/item-authoring/ui/DetailReference";

/** Presents one authored item selector in editor detail copy. */
export const SelectorDetail = ({
	selector,
	description,
}: {
	readonly selector: SelectorSchema.Type;
	readonly description?: ReactNode;
}) => (
	<DetailReference
		itemId={selector.itemId}
		description={description}
	/>
);

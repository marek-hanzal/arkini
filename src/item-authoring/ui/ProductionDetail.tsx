import { Factory } from "lucide-react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ProductionLineDetail } from "~/item-authoring/ui/ProductionLineDetail";
import { Status } from "~/ui/ui/Status";

/** Presents production lines or the disabled contract. */
export const ProductionDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const lines = item.lines;
	if (lines.length > 0)
		return (
			<div className="ak-list grid gap-3">
				{lines.map((line) => (
					<ProductionLineDetail
						itemUid={item.uid}
						key={line.id}
						line={line}
					/>
				))}
			</div>
		);
	return (
		<Status
			dataUi="EditorProductionLinesDisabledStatus"
			description="This item has no production lines, so it cannot run production jobs or transform inputs into outputs. Configure a production-capable item to add that behavior."
			icon={Factory}
			title="Production lines are disabled"
		/>
	);
};

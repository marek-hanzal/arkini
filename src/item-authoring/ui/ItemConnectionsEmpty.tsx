import { Unlink } from "lucide-react";
import type { ItemConnectionFilter } from "~/flow/type/ItemConnectionFilter";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Status } from "~/ui/ui/Status";

const EmptyStateByFilter = {
	"required-by": {
		description: "No authored item directly inputs or positively requires this item.",
		title: "Nothing requires this item",
	},
	inputs: {
		description:
			"No authored operation owned by this item directly inputs or positively requires another item.",
		title: "This item has no inputs",
	},
	produces: {
		description: "No authored operation owned by this item outputs another item.",
		title: "This item produces nothing",
	},
	"produced-by": {
		description:
			"No other authored item outputs this item through production, expiry, units, or merges.",
		title: "Nothing produces this item",
	},
} as const satisfies Record<
	ItemConnectionFilter,
	{
		readonly description: string;
		readonly title: string;
	}
>;

/** Shares the exact empty connection meaning between the overview and full collection. */
export const ItemConnectionsEmpty = ({
	filter,
	expanded = false,
}: {
	readonly filter: ItemConnectionFilter;
	readonly expanded?: boolean;
}) => {
	const translator = useTranslator();
	const state = EmptyStateByFilter[filter];
	return (
		<Status
			dataUi="EditorItemConnectionsEmpty"
			icon={Unlink}
			title={translator.textFn(state.title)}
			description={expanded ? translator.textFn(state.description) : undefined}
			size={expanded ? "large" : "normal"}
			variant="flat"
		/>
	);
};

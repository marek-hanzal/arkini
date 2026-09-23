import { useMemo } from "react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ItemConnectionFilterSchema } from "~/graph/schema/ItemConnectionFilterSchema";
import { readItemConnectionQueryFn } from "~/graph/fn/readItemConnectionQueryFn";
import { useEditorGraphQuery } from "~/graph/ui/useEditorGraphQuery";
import { GraphQueryResult } from "~/graph/ui/GraphQueryResult";
import { ItemDetailSectionHeader } from "~/item-authoring/ui/ItemDetailSectionHeader";
import { useTranslator } from "~/translation/ui/useTranslator";

const Views = [
	{
		filter: "required-by",
		title: "Required by",
	},
	{
		filter: "inputs",
		title: "Inputs",
	},
	{
		filter: "produces",
		title: "Produces",
	},
	{
		filter: "produced-by",
		title: "Produced by",
	},
] as const;

/** Four compact previews borrow the same session; each link opens its complete query. */
export const ConnectionsSummaryDetail = ({ item }: { readonly item: ItemSchema.Type }) => (
	<>
		{Views.map((view) => (
			<ConnectionPreview
				key={view.filter}
				itemUid={item.uid}
				{...view}
			/>
		))}
	</>
);

const ConnectionPreview = ({
	itemUid,
	filter,
	title,
}: {
	readonly itemUid: string;
	readonly filter: ItemConnectionFilterSchema.Type;
	readonly title: string;
}) => {
	const translator = useTranslator();
	const query = useMemo(
		() => ({
			...readItemConnectionQueryFn(itemUid, filter),
			limit: 2,
		}),
		[
			itemUid,
			filter,
		],
	);
	const state = useEditorGraphQuery(query);
	return (
		<section
			className="grid min-w-0 grid-rows-[auto_1fr] gap-3"
			data-ui="EditorItemConnectionsSummary"
		>
			<ItemDetailSectionHeader
				itemUid={itemUid}
				sectionId="connections"
				filter={filter}
				title={translator.textFn(title)}
			/>
			<GraphQueryResult state={state} />
		</section>
	);
};

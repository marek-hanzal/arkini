import { useMemo } from "react";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { readItemConnectionsFn } from "~/item-authoring/fn/readItemConnectionsFn";
import { ItemConnectionRow } from "~/item-authoring/ui/ItemConnectionRow";
import { ItemConnectionsEmpty } from "~/item-authoring/ui/ItemConnectionsEmpty";
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

/** Appends the four authored connection previews, each capped at two items. */
export const ConnectionsSummaryDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const views = useMemo(
		() =>
			Views.map((view) => ({
				...view,
				connections: readItemConnectionsFn(project.config, item.uid, view.filter),
			})),
		[
			project.config,
			item.uid,
		],
	);
	return (
		<>
			{views.map(({ filter, title, connections }) => (
				<section
					className="grid min-w-0 grid-rows-[auto_1fr] gap-3"
					data-ui="EditorItemConnectionsSummary"
					key={filter}
				>
					<ItemDetailSectionHeader
						itemUid={item.uid}
						sectionId="connections"
						filter={filter}
						title={translator.textFn(title)}
					/>
					<div className="grid">
						{connections.length === 0 ? (
							<EditorRootCard dataUi="EditorItemConnectionsEmptyCard">
								<ItemConnectionsEmpty filter={filter} />
							</EditorRootCard>
						) : (
							<div className="ak-list grid content-start gap-2">
								{connections.slice(0, 2).map(({ item: connectedItem, origins }) => (
									<ItemConnectionRow
										key={connectedItem.uid}
										item={connectedItem}
										origins={origins}
										owner={
											filter === "required-by" || filter === "produced-by"
												? connectedItem
												: item
										}
									/>
								))}
							</div>
						)}
					</div>
				</section>
			))}
		</>
	);
};

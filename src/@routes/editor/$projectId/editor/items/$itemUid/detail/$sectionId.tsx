import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { ConnectionsSection } from "~/item-authoring/ui/ConnectionsSection";
import { DeleteSection } from "~/item-authoring/ui/DeleteSection";
import { ItemEstimateSection } from "~/estimate/ui/ItemEstimateSection";
import { InteractionsDetail } from "~/item-authoring/ui/InteractionsDetail";
import { IdentityDetail } from "~/item-authoring/ui/IdentityDetail";
import { NotFound } from "~/item-authoring/ui/NotFound";
import { ProductionDetail } from "~/item-authoring/ui/ProductionDetail";
import { type ItemConnectionFilter, ItemConnectionFilters } from "~/flow/type/ItemConnectionFilter";
import { type DetailSectionId } from "~/item-authoring/type/Section";
import { readSectionsFn } from "~/item-authoring/fn/readSectionsFn";
import { useItemByUid } from "~/item-authoring/ui/useItemByUid";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { ProjectNotes } from "~/project-note/ui/ProjectNotes";
import { useProjectNotes } from "~/project-note/ui/useProjectNotes";

const ItemNotes = ({ itemUid }: { readonly itemUid: string }) => {
	const project = useEditorProject();
	const collection = useProjectNotes(project.projectId);
	return (
		<ProjectNotes
			defaultResourceIds={[]}
			collection={collection}
			notes={collection.notes.filter((note) => note.itemUids.includes(itemUid))}
			requiredCurrentItemUid={itemUid}
			defaultItemUids={[
				itemUid,
			]}
		/>
	);
};

interface EditorItemDetailRouteSearch {
	readonly filter?: ItemConnectionFilter;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/detail/$sectionId")({
	validateSearch: (search): EditorItemDetailRouteSearch => ({
		filter: ItemConnectionFilters.find((filter) => filter === search.filter),
	}),
	beforeLoad: ({ params }) => {
		if (
			params.sectionId === "delete" ||
			readSectionsFn().some((section) => section.id === params.sectionId)
		)
			return;
		throw redirect({
			to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
			params: {
				...params,
				sectionId: "identity",
			},
			replace: true,
		});
	},
	component: () => {
		const { itemUid, sectionId } = Route.useParams();
		const search = Route.useSearch();
		const navigateFn = useNavigate({
			from: Route.fullPath,
		});
		const item = useItemByUid(itemUid);
		if (item === undefined) return <NotFound uid={itemUid} />;
		const section = sectionId as DetailSectionId;
		switch (section) {
			case "identity":
				return <IdentityDetail item={item} />;
			case "interactions":
				return <InteractionsDetail item={item} />;
			case "production":
				return <ProductionDetail item={item} />;
			case "estimate":
				return <ItemEstimateSection itemId={item.id} />;
			case "connections": {
				const filter = search.filter ?? "required-by";
				return (
					<ConnectionsSection
						filter={filter}
						itemId={item.id}
						onFilterChangeFn={(nextFilter) =>
							void navigateFn({
								replace: true,
								search: (current) => ({
									...current,
									filter: nextFilter,
								}),
							})
						}
					/>
				);
			}
			case "notes":
				return (
					<ItemNotes
						key={item.uid}
						itemUid={item.uid}
					/>
				);
			case "delete":
				return <DeleteSection item={item} />;
		}
	},
});

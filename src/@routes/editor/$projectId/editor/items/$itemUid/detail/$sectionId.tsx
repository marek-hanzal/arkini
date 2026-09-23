import { ArtworkDetail } from "~/item-authoring/ui/ArtworkDetail";
import { ClockDetail } from "~/item-authoring/ui/ClockDetail";
import { UnitsDetail } from "~/item-authoring/ui/CapabilityDetails";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { ItemChain } from "~/item-chain/ui/ItemChain";
import { MergesCollectionDetail } from "~/item-authoring/ui/MergesCollectionDetail";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { ConnectionsSection } from "~/item-authoring/ui/ConnectionsSection";
import { DeleteSection } from "~/item-authoring/ui/DeleteSection";
import { IdentityDetail } from "~/item-authoring/ui/IdentityDetail";
import { NotFound } from "~/item-authoring/ui/NotFound";
import { ProductionDetail } from "~/item-authoring/ui/ProductionDetail";
import { ItemConnectionFilterSchema } from "~/graph/schema/ItemConnectionFilterSchema";
import { type SectionId } from "~/item-authoring/type/Section";
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
			defaultResourceUids={[]}
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
	readonly filter?: ItemConnectionFilterSchema.Type;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/detail/$sectionId")({
	validateSearch: (search): EditorItemDetailRouteSearch => ({
		filter: ItemConnectionFilterSchema.options.find((filter) => filter === search.filter),
	}),
	beforeLoad: ({ params }) => {
		if (readSectionsFn().some((section) => section.id === params.sectionId)) return;
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
		const section = sectionId as SectionId;
		switch (section) {
			case "identity":
				return <IdentityDetail item={item} />;
			case "artwork":
				return (
					<EditorRootCard dataUi="EditorItemArtworkDetailCard">
						<ArtworkDetail
							item={item}
							layout="detail"
						/>
					</EditorRootCard>
				);
			case "units":
				return <UnitsDetail item={item} />;
			case "clock":
				return <ClockDetail item={item} />;
			case "production":
				return <ProductionDetail item={item} />;
			case "merges":
				return <MergesCollectionDetail item={item} />;
			case "chain":
				return <ItemChain itemUid={item.uid} />;
			case "connections": {
				const filter = search.filter ?? "all";
				return (
					<ConnectionsSection
						filter={filter}
						itemUid={item.uid}
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

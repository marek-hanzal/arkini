import { createFileRoute, redirect } from "@tanstack/react-router";

import { ArtworkDetail } from "~/item-authoring/ui/ArtworkDetail";
import { ChargesDetail, MergesDetail } from "~/item-authoring/ui/CapabilityDetails";
import { DeleteSection } from "~/item-authoring/ui/DeleteSection";
import { ItemEstimateSection } from "~/estimate/ui/ItemEstimateSection";
import { IdentityDetail } from "~/item-authoring/ui/IdentityDetail";
import { NotFound } from "~/item-authoring/ui/NotFound";
import { ProductionDetail } from "~/item-authoring/ui/ProductionDetail";
import { type SectionId, SectionIds } from "~/item-authoring/type/Section";
import { SpaceActionDetail } from "~/item-authoring/ui/SpaceActionDetail";
import { readSectionsFn } from "~/item-authoring/fn/readSectionsFn";
import { useItemByUid } from "~/item-authoring/ui/useItemByUid";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/detail/$sectionId")({
	beforeLoad: ({ params }) => {
		if (SectionIds.some((section) => section === params.sectionId)) return;
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
		const item = useItemByUid(itemUid);
		if (item === undefined) return <NotFound uid={itemUid} />;
		const section = sectionId as SectionId;
		const available = readSectionsFn(item).some((candidate) => candidate.id === section);
		if (!available)
			return (
				<section
					className="grid gap-2 py-8 text-center"
					data-ui="EditorItemSectionUnavailable"
				>
					<h2 className="text-lg font-semibold">Section unavailable</h2>
					<p className="text-sm text-muted">
						This item type does not use the {section} section.
					</p>
				</section>
			);
		switch (section) {
			case "identity":
				return <IdentityDetail item={item} />;
			case "artwork":
				return <ArtworkDetail item={item} />;
			case "charges":
				return <ChargesDetail item={item} />;
			case "merges":
				return <MergesDetail item={item} />;
			case "action":
				return <SpaceActionDetail item={item} />;
			case "production":
				return <ProductionDetail item={item} />;
			case "estimate":
				return <ItemEstimateSection itemId={item.id} />;
			case "delete":
				return <DeleteSection item={item} />;
		}
	},
});

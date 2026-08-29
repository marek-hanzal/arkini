import { createFileRoute, redirect } from "@tanstack/react-router";

import { EditorItemArtworkDetail } from "~/item-authoring/ui/EditorItemArtworkDetail";
import {
	EditorItemChargesDetail,
	EditorItemMergesDetail,
} from "~/item-authoring/ui/EditorItemCapabilityDetails";
import { EditorItemDeleteSection } from "~/item-authoring/ui/EditorItemDeleteSection";
import { EditorItemEstimateSection } from "~/estimate/ui/EditorItemEstimateSection";
import { EditorItemIdentityDetail } from "~/item-authoring/ui/EditorItemIdentityDetail";
import { EditorItemNotFound } from "~/item-authoring/ui/EditorItemNotFound";
import { EditorItemProductionDetail } from "~/item-authoring/ui/EditorItemProductionDetail";
import {
	type EditorItemSectionId,
	EditorItemSectionIds,
} from "~/item-authoring/ui/EditorItemSections";
import { EditorSpaceActionDetail } from "~/item-authoring/ui/EditorSpaceActionDetail";
import { readEditorItemSectionsFn } from "~/item-authoring/ui/fn/readEditorItemSectionsFn";
import { useEditorItemByUid } from "~/item-authoring/ui/useEditorItemByUid";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/detail/$sectionId")({
	beforeLoad: ({ params }) => {
		if (EditorItemSectionIds.some((section) => section === params.sectionId)) return;
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
		const item = useEditorItemByUid(itemUid);
		if (item === undefined) return <EditorItemNotFound uid={itemUid} />;
		const section = sectionId as EditorItemSectionId;
		const available = readEditorItemSectionsFn(item).some(
			(candidate) => candidate.id === section,
		);
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
				return <EditorItemIdentityDetail item={item} />;
			case "artwork":
				return <EditorItemArtworkDetail item={item} />;
			case "charges":
				return <EditorItemChargesDetail item={item} />;
			case "merges":
				return <EditorItemMergesDetail item={item} />;
			case "action":
				return <EditorSpaceActionDetail item={item} />;
			case "production":
				return <EditorItemProductionDetail item={item} />;
			case "estimate":
				return <EditorItemEstimateSection itemId={item.id} />;
			case "delete":
				return <EditorItemDeleteSection item={item} />;
		}
	},
});

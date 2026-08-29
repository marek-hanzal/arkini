import { createFileRoute, redirect } from "@tanstack/react-router";

import { EditorItemArtworkDetail } from "~/ui/item/editor/EditorItemArtworkDetail";
import {
	EditorItemChargesDetail,
	EditorItemMergesDetail,
} from "~/ui/item/editor/EditorItemCapabilityDetails";
import { EditorItemDeleteSection } from "~/ui/item/editor/EditorItemDeleteSection";
import { EditorItemEstimateSection } from "~/ui/item/editor/EditorItemEstimateSection";
import { EditorItemIdentityDetail } from "~/ui/item/editor/EditorItemIdentityDetail";
import { EditorItemNotFound } from "~/ui/item/editor/EditorItemNotFound";
import { EditorItemProductionDetail } from "~/ui/item/editor/EditorItemProductionDetail";
import {
	type EditorItemSectionId,
	EditorItemSectionIds,
} from "~/ui/item/editor/EditorItemSections";
import { EditorSpaceActionDetail } from "~/ui/item/editor/EditorSpaceActionDetail";
import { readEditorItemSectionsFn } from "~/ui/item/editor/fn/readEditorItemSectionsFn";
import { useEditorItemByUid } from "~/ui/item/editor/useEditorItemByUid";

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

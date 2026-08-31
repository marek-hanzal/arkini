import { createFileRoute, redirect } from "@tanstack/react-router";

import { EditorItemArtworkSection } from "~/item-authoring/ui/EditorItemArtworkSection";
import { EditorItemChargesSection } from "~/item-authoring/ui/EditorItemChargesSection";
import { useEditorItemFormSession } from "~/item-authoring/ui/EditorItemFormContext";
import { EditorItemIdentitySection } from "~/item-authoring/ui/EditorItemIdentitySection";
import { EditorItemMergesSection } from "~/item-authoring/ui/EditorItemMergesSection";
import { EditorItemProductionSection } from "~/item-authoring/ui/EditorItemProductionSection";
import {
	type EditorItemSectionId,
	EditorItemSectionIds,
} from "~/item-authoring/type/EditorItemSection";
import { EditorSpaceActionSection } from "~/item-authoring/ui/EditorSpaceActionSection";
import { readEditorItemSectionsFn } from "~/item-authoring/fn/readEditorItemSectionsFn";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/form/$sectionId")({
	beforeLoad: ({ params }) => {
		if (EditorItemSectionIds.some((section) => section === params.sectionId)) return;
		throw redirect({
			to: "/editor/$projectId/editor/items/$itemUid/form/$sectionId",
			params: {
				...params,
				sectionId: "identity",
			},
			search: true,
			replace: true,
		});
	},
	component: () => {
		const { sectionId } = Route.useParams();
		const section = sectionId as EditorItemSectionId;
		const session = useEditorItemFormSession();
		const available = readEditorItemSectionsFn(session.initialItem, "form").some(
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
				return <EditorItemIdentitySection />;
			case "artwork":
				return <EditorItemArtworkSection />;
			case "charges":
				return <EditorItemChargesSection />;
			case "merges":
				return <EditorItemMergesSection />;
			case "action":
				return <EditorSpaceActionSection />;
			case "production":
				return <EditorItemProductionSection />;
		}
	},
});

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { EditorItemArtworkDetail } from "~/ui/item/editor/EditorItemArtworkDetail";
import {
	EditorItemChargesDetail,
	EditorItemMergesDetail,
} from "~/ui/item/editor/EditorItemCapabilityDetails";
import { EditorItemEstimateSection } from "~/ui/item/editor/EditorItemEstimateSection";
import { EditorItemDeleteSection } from "~/ui/item/editor/EditorItemDeleteSection";
import { EditorItemIdentityDetail } from "~/ui/item/editor/EditorItemIdentityDetail";
import { EditorItemNotFound } from "~/ui/item/editor/EditorItemNotFound";
import { EditorItemProductionDetail } from "~/ui/item/editor/EditorItemProductionDetail";
import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";
import { readEditorItemSectionsFx } from "~/ui/item/editor/readEditorItemSectionsFx";
import { useEditorItemByUid } from "~/ui/item/editor/useEditorItemByUid";

/** Resolves and dispatches one canonical read-only item section. */
export const EditorItemDetailSectionPage = ({
	sectionId,
	uid,
}: {
	readonly sectionId: EditorItemSectionId;
	readonly uid: string;
}) => {
	const item = useEditorItemByUid(uid);
	if (item === undefined) return <EditorItemNotFound uid={uid} />;
	const available = RendererRuntime.runSync(readEditorItemSectionsFx(item)).some(
		(candidate) => candidate.id === sectionId,
	);
	if (!available)
		return (
			<section
				className="grid gap-2 py-8 text-center"
				data-ui="EditorItemSectionUnavailable"
			>
				<h2 className="text-lg font-semibold">Section unavailable</h2>
				<p className="text-sm text-muted">
					This item type does not use the {sectionId} section.
				</p>
			</section>
		);
	switch (sectionId) {
		case "identity":
			return <EditorItemIdentityDetail item={item} />;
		case "artwork":
			return <EditorItemArtworkDetail item={item} />;
		case "charges":
			return <EditorItemChargesDetail item={item} />;
		case "merges":
			return <EditorItemMergesDetail item={item} />;
		case "production":
			return <EditorItemProductionDetail item={item} />;
		case "estimate":
			return <EditorItemEstimateSection itemId={item.id} />;
		case "delete":
			return <EditorItemDeleteSection item={item} />;
	}
};

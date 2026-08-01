import { EditorSectionPage } from "~/ui/editor/EditorSectionPage";
import { EditorSectionTabs } from "~/ui/editor/EditorSectionTabs";
import { EditorItemArtworkSection } from "~/ui/item/editor/EditorItemArtworkSection";
import { EditorItemChargesSection } from "~/ui/item/editor/EditorItemChargesSection";
import { useEditorItemFormSession } from "~/ui/item/editor/EditorItemFormContext";
import { EditorItemIdentitySection } from "~/ui/item/editor/EditorItemIdentitySection";
import { EditorItemLimitsSection } from "~/ui/item/editor/EditorItemLimitsSection";
import { EditorItemSectionLink } from "~/ui/item/editor/EditorItemSectionLink";
import { EditorItemMergesSection } from "~/ui/item/editor/EditorItemMergesSection";
import { EditorItemProductionSection } from "~/ui/item/editor/EditorItemProductionSection";
import {
	readEditorItemSections,
	type EditorItemSectionId,
} from "~/ui/item/editor/EditorItemSections";

const renderSection = (section: EditorItemSectionId) => {
	switch (section) {
		case "identity":
			return <EditorItemIdentitySection />;
		case "artwork":
			return <EditorItemArtworkSection />;
		case "limits":
			return <EditorItemLimitsSection />;
		case "charges":
			return <EditorItemChargesSection />;
		case "merges":
			return <EditorItemMergesSection />;
		case "production":
			return <EditorItemProductionSection />;
	}
};

/** Renders one explicit item-form section from the shared parent form session. */
export const EditorItemSectionPage = ({ section }: { readonly section: EditorItemSectionId }) => {
	const session = useEditorItemFormSession();
	const sections = readEditorItemSections(session.initialItem);
	const available = sections.some((candidate) => candidate.id === section);
	const params = {
		projectId: session.project.projectId,
		itemUid: session.initialItem.uid,
	};
	return (
		<EditorSectionPage
			tabs={
				<EditorSectionTabs label="Item sections">
					{sections.map((candidate) => (
						<EditorItemSectionLink
							key={candidate.id}
							itemUid={params.itemUid}
							projectId={params.projectId}
							route={session.route}
							section={candidate}
						/>
					))}
				</EditorSectionTabs>
			}
		>
			{available ? (
				renderSection(section)
			) : (
				<section
					className="grid gap-2 py-8 text-center"
					data-ui="EditorItemSectionUnavailable"
				>
					<h2 className="text-lg font-semibold">Section unavailable</h2>
					<p className="text-sm text-muted">
						This item type does not use the {section} section.
					</p>
				</section>
			)}
		</EditorSectionPage>
	);
};

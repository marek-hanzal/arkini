import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { EditorItemArtworkSection } from "~/ui/item/editor/EditorItemArtworkSection";
import { EditorItemChargesSection } from "~/ui/item/editor/EditorItemChargesSection";
import { useEditorItemFormSession } from "~/ui/item/editor/EditorItemFormContext";
import { EditorItemIdentitySection } from "~/ui/item/editor/EditorItemIdentitySection";
import { EditorItemMergesSection } from "~/ui/item/editor/EditorItemMergesSection";
import { EditorItemProductionSection } from "~/ui/item/editor/EditorItemProductionSection";
import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";
import { readEditorItemFormSectionsFx } from "~/ui/item/editor/readEditorItemFormSectionsFx";

const renderSection = (section: EditorItemSectionId) => {
	switch (section) {
		case "identity":
			return <EditorItemIdentitySection />;
		case "artwork":
			return <EditorItemArtworkSection />;
		case "charges":
			return <EditorItemChargesSection />;
		case "merges":
			return <EditorItemMergesSection />;
		case "production":
			return <EditorItemProductionSection />;
		case "flow":
			return null;
	}
};

/** Renders one explicit item-form section from the shared parent form session. */
export const EditorItemSectionPage = ({ section }: { readonly section: EditorItemSectionId }) => {
	const session = useEditorItemFormSession();
	const sections = RendererRuntime.runSync(readEditorItemFormSectionsFx(session.initialItem));
	const available = sections.some((candidate) => candidate.id === section);
	return available ? (
		renderSection(section)
	) : (
		<section
			className="grid gap-2 py-8 text-center"
			data-ui="EditorItemSectionUnavailable"
		>
			<h2 className="text-lg font-semibold">Section unavailable</h2>
			<p className="text-sm text-muted">This item type does not use the {section} section.</p>
		</section>
	);
};

import { ButtonLink } from "~/ui/button/Button";
import { EditorSectionNavigation } from "~/ui/editor/EditorSectionNavigation";
import { EditorSectionPage } from "~/ui/editor/EditorSectionPage";
import { EditorSectionTabs } from "~/ui/editor/EditorSectionTabs";
import { EditorFormContent } from "~/ui/form/EditorFormContent";
import { EditorFormSaveButton } from "~/ui/form/EditorFormSaveButton";
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
	const title = session.isNew
		? `New ${session.initialItem.type}`
		: session.initialItem.title || session.initialItem.id;
	return (
		<EditorSectionPage
			tabs={
				<EditorSectionNavigation
					leading={
						session.isNew ? (
							<ButtonLink
								to="/editor/$projectId/editor/items/list"
								params={{
									projectId: params.projectId,
								}}
								className="min-h-0 px-3 py-2"
							>
								<span className="icon-[lucide--arrow-left] size-4" />
							</ButtonLink>
						) : (
							<ButtonLink
								to="/editor/$projectId/editor/items/$itemUid/view"
								params={params}
								className="min-h-0 px-3 py-2"
							>
								<span className="icon-[lucide--arrow-left] size-4" />
							</ButtonLink>
						)
					}
					title={
						<div className="flex min-w-0 items-baseline gap-2">
							<h1 className="truncate text-xl font-semibold">{title}</h1>
							<span className="shrink-0 text-xs uppercase tracking-wider text-muted">
								{session.initialItem.type}
							</span>
						</div>
					}
					tabs={
						<EditorSectionTabs label="Item sections">
							{sections.map((candidate) => (
								<EditorItemSectionLink
									key={candidate.id}
									itemType={session.itemType}
									itemUid={params.itemUid}
									projectId={params.projectId}
									section={candidate}
								/>
							))}
						</EditorSectionTabs>
					}
					action={
						<EditorFormSaveButton
							dirty={session.isDirty}
							saving={session.isSaving}
							save={session.save}
						/>
					}
				/>
			}
		>
			<div className="grid gap-[var(--ak-viewport-gap)]">
				<EditorFormContent
					error={session.error}
					save={session.save}
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
				</EditorFormContent>
			</div>
		</EditorSectionPage>
	);
};

import { LogIn, LogOut, Pencil } from "lucide-react";
import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/ui/editor/useEditorProject";
import { ButtonLink, PrimaryButtonLink } from "~/ui/button/Button";
import { EditorHistoryBackButton } from "~/ui/editor/EditorHistoryBackButton";
import { EditorSectionNavigation } from "~/ui/editor/EditorSectionNavigation";
import { EditorSectionPage } from "~/ui/editor/EditorSectionPage";
import { EditorSectionTabs } from "~/ui/editor/EditorSectionTabs";
import { EditorRootCard } from "~/ui/editor/EditorRootCard";
import { useEditorEditShortcut } from "~/ui/editor/useEditorEditShortcut";
import { ItemTypeLabel } from "~/ui/item-detail/ItemInfoPresentation";
import { EditorItemNotFound } from "~/ui/item/editor/EditorItemNotFound";
import { EditorItemConvertMenu } from "~/ui/item/editor/EditorItemConvertMenu";
import { EditorItemSectionLink } from "~/ui/item/editor/EditorItemSectionLink";
import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";
import { readEditorItemSectionsFn } from "~/ui/item/editor/fn/readEditorItemSectionsFn";
import { useEditorItemByUid } from "~/ui/item/editor/useEditorItemByUid";

/** Owns the stable item-detail header while routed sections replace only its body. */
export const EditorItemDetail = ({
	children,
	sectionId,
	uid,
}: PropsWithChildren<{
	readonly sectionId: EditorItemSectionId;
	readonly uid: string;
}>) => {
	const project = useEditorProject();
	const editActionRef = useEditorEditShortcut();
	const item = useEditorItemByUid(uid);
	if (item === undefined) return <EditorItemNotFound uid={uid} />;
	const params = {
		projectId: project.projectId,
		itemUid: item.uid,
	};
	const editableSectionId =
		sectionId === "estimate" || sectionId === "delete" ? "identity" : sectionId;
	const sections = readEditorItemSectionsFn(item);
	return (
		<EditorSectionPage
			tabs={
				<EditorSectionNavigation
					leading={
						<EditorHistoryBackButton
							to="/editor/$projectId/editor/items/list"
							params={{
								projectId: project.projectId,
							}}
						/>
					}
					title={
						<div className="grid min-w-0 gap-0.5">
							<h1 className="truncate text-xl font-semibold">
								{item.title || item.id}
							</h1>
							<span
								className="truncate text-xs font-medium uppercase tracking-[0.08em] text-muted"
								data-ui="EditorItemType"
							>
								{ItemTypeLabel[item.type]}
							</span>
						</div>
					}
					tabs={
						<EditorSectionTabs label="Item sections">
							{sections.map((section) => (
								<EditorItemSectionLink
									destination="detail"
									itemUid={item.uid}
									key={section.id}
									projectId={project.projectId}
									section={section}
								/>
							))}
						</EditorSectionTabs>
					}
					action={
						<div className="flex items-center gap-2">
							<ButtonLink
								className="h-10 min-h-10 gap-2 px-3 py-2 text-sm"
								params={{
									projectId: project.projectId,
								}}
								search={{
									direction: "input",
									itemId: item.id,
								}}
								to="/editor/$projectId/flow"
							>
								<LogIn className="size-4" />
								Inputs
							</ButtonLink>
							<ButtonLink
								className="h-10 min-h-10 gap-2 px-3 py-2 text-sm"
								params={{
									projectId: project.projectId,
								}}
								search={{
									direction: "output",
									itemId: item.id,
								}}
								to="/editor/$projectId/flow"
							>
								<LogOut className="size-4" />
								Outputs
							</ButtonLink>
							<EditorItemConvertMenu
								itemType={item.type}
								itemUid={item.uid}
								projectId={project.projectId}
							/>
							<PrimaryButtonLink
								ref={editActionRef}
								to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
								params={{
									...params,
									sectionId: editableSectionId,
								}}
								className="h-10 min-h-10 gap-2 px-3 py-2 text-sm"
							>
								<Pencil className="size-4" />
								Edit
							</PrimaryButtonLink>
						</div>
					}
				/>
			}
		>
			{sectionId === "estimate" || sectionId === "production" ? (
				children
			) : (
				<EditorRootCard dataUi="EditorItemDetailCard">{children}</EditorRootCard>
			)}
		</EditorSectionPage>
	);
};

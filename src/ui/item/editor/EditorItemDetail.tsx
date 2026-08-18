import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { ButtonLink, PrimaryButtonLink } from "~/ui/button/Button";
import { editorBackLinkClassName, EditorBackIcon } from "~/ui/editor/EditorBackIcon";
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
import { readEditorItemSectionsFx } from "~/ui/item/editor/readEditorItemSectionsFx";
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
		sectionId === "estimate" || sectionId === "flow" ? "identity" : sectionId;
	const sections = RendererRuntime.runSync(readEditorItemSectionsFx(item));
	return (
		<EditorSectionPage
			tabs={
				<EditorSectionNavigation
					leading={
						<ButtonLink
							to="/editor/$projectId/editor/items/list"
							params={{
								projectId: project.projectId,
							}}
							className={editorBackLinkClassName}
						>
							<EditorBackIcon />
						</ButtonLink>
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
								<span className="icon-[lucide--pencil] size-4" />
								Edit
							</PrimaryButtonLink>
						</div>
					}
				/>
			}
		>
			{sectionId === "estimate" || sectionId === "production" || sectionId === "flow" ? (
				children
			) : (
				<EditorRootCard dataUi="EditorItemDetailCard">{children}</EditorRootCard>
			)}
		</EditorSectionPage>
	);
};

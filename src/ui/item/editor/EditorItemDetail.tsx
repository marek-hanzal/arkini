import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { ButtonLink, PrimaryButtonLink } from "~/ui/button/Button";
import { editorBackLinkClassName, EditorBackIcon } from "~/ui/editor/EditorBackIcon";
import { EditorSectionNavigation } from "~/ui/editor/EditorSectionNavigation";
import { EditorSectionPage } from "~/ui/editor/EditorSectionPage";
import { EditorSectionTabs } from "~/ui/editor/EditorSectionTabs";
import { EditorItemNotFound } from "~/ui/item/editor/EditorItemNotFound";
import { EditorItemSectionLink } from "~/ui/item/editor/EditorItemSectionLink";
import {
	readEditorItemSections,
	type EditorItemSectionId,
} from "~/ui/item/editor/EditorItemSections";
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
	const item = useEditorItemByUid(uid);
	if (item === undefined) return <EditorItemNotFound uid={uid} />;
	const params = {
		projectId: project.projectId,
		itemUid: item.uid,
	};
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
						<div className="flex min-w-0 items-baseline gap-2">
							<h1 className="truncate text-xl font-semibold">
								{item.title || item.id}
							</h1>
							<span className="shrink-0 text-xs uppercase tracking-wider text-muted">
								{item.type}
							</span>
						</div>
					}
					tabs={
						<EditorSectionTabs label="Item sections">
							{readEditorItemSections(item).map((section) => (
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
						<PrimaryButtonLink
							to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
							params={{
								...params,
								sectionId,
							}}
							className="min-h-0 gap-2 px-4 py-2 text-sm"
						>
							<span className="icon-[lucide--pencil] size-4" />
							Edit
						</PrimaryButtonLink>
					}
				/>
			}
		>
			{children}
		</EditorSectionPage>
	);
};

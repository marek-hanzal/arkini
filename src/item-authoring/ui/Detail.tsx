import { Pencil } from "lucide-react";
import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { PrimaryButtonLink } from "~/ui/ui/Button";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import {
	EditorSectionNavigation,
	EditorSectionNavigationSeparator,
} from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorSectionTabs } from "~/authoring-shell/ui/EditorSectionTabs";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { useEditorEditShortcut } from "~/authoring-shell/ui/useEditorEditShortcut";
import { NotFound } from "~/item-authoring/ui/NotFound";
import { SectionLink } from "~/item-authoring/ui/SectionLink";
import type { SectionId } from "~/item-authoring/type/Section";
import { readSectionsFn } from "~/item-authoring/fn/readSectionsFn";
import { useItemByUid } from "~/item-authoring/ui/useItemByUid";
import { ItemDraftToggle } from "~/item-authoring/ui/ItemDraftToggle";
import { ItemSectionHelp } from "~/item-authoring/ui/ItemSectionHelp";

/** Owns the stable item-detail header while routed sections replace only its body. */
export const Detail = ({
	children,
	sectionId,
	uid,
}: PropsWithChildren<{
	readonly sectionId: SectionId;
	readonly uid: string;
}>) => {
	const project = useEditorProject();
	const editActionRef = useEditorEditShortcut();
	const item = useItemByUid(uid);
	if (item === undefined) return <NotFound uid={uid} />;
	const params = {
		projectId: project.projectId,
		itemUid: item.uid,
	};
	const editableSectionId =
		sectionId === "estimate" ||
		sectionId === "connections" ||
		sectionId === "delete" ||
		sectionId === "notes"
			? "identity"
			: sectionId;
	const help = ItemSectionHelp[sectionId];
	const sections = readSectionsFn();
	return (
		<EditorSectionPage
			header={
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
						<h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold">
							<span className="truncate">{item.title || item.id}</span>
						</h1>
					}
					tabs={
						<EditorSectionTabs>
							{sections.map((section) => (
								<SectionLink
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
							{help === undefined ? null : (
								<>
									<EditorPageHelp {...help} />
									<EditorSectionNavigationSeparator />
								</>
							)}
							<ItemDraftToggle item={item} />
							<EditorSectionNavigationSeparator />
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
			{sectionId === "identity" ||
			sectionId === "units" ||
			sectionId === "clock" ||
			sectionId === "delete" ||
			sectionId === "notes" ||
			sectionId === "estimate" ||
			sectionId === "merges" ||
			sectionId === "connections" ||
			sectionId === "production" ? (
				children
			) : (
				<EditorRootCard dataUi="EditorItemDetailCard">{children}</EditorRootCard>
			)}
		</EditorSectionPage>
	);
};

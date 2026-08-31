import { LogIn, LogOut, Pencil } from "lucide-react";
import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { ButtonLink, PrimaryButtonLink } from "~/ui/ui/Button";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorSectionTabs } from "~/authoring-shell/ui/EditorSectionTabs";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { useEditorEditShortcut } from "~/authoring-shell/ui/useEditorEditShortcut";
import { ItemTypeLabel } from "~/item-definition/ui/ItemDefinitionLabels";
import { NotFound } from "~/item-authoring/ui/NotFound";
import { ConvertMenu } from "~/item-authoring/ui/ConvertMenu";
import { SectionLink } from "~/item-authoring/ui/SectionLink";
import type { SectionId } from "~/item-authoring/type/Section";
import { readSectionsFn } from "~/item-authoring/fn/readSectionsFn";
import { useItemByUid } from "~/item-authoring/ui/useItemByUid";

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
		sectionId === "estimate" || sectionId === "delete" ? "identity" : sectionId;
	const sections = readSectionsFn(item);
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
							<ConvertMenu
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

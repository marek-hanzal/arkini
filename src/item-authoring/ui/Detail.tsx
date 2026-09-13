import { ItemHeaderTitle } from "~/item-authoring/ui/ItemHeaderTitle";
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
import { useTranslator } from "~/translation/ui/useTranslator";
import { useEditorEditShortcut } from "~/authoring-shell/ui/useEditorEditShortcut";
import { NotFound } from "~/item-authoring/ui/NotFound";
import { SectionLink } from "~/item-authoring/ui/SectionLink";
import type { DetailSectionId } from "~/item-authoring/type/Section";
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
	readonly sectionId: DetailSectionId;
	readonly uid: string;
}>) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const editActionRef = useEditorEditShortcut();
	const item = useItemByUid(uid);
	if (item === undefined) return <NotFound uid={uid} />;
	const params = {
		projectId: project.projectId,
		itemUid: item.uid,
	};
	const editableSectionId =
		sectionId === "identity" || sectionId === "production" || sectionId === "merges"
			? sectionId
			: "identity";
	const help = ItemSectionHelp[sectionId];
	const sections = readSectionsFn();
	return (
		<EditorSectionPage
			contentMode={sectionId === "notes" ? "viewport" : "scroll"}
			fillContent={sectionId === "connections"}
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
						<ItemHeaderTitle
							resourceIds={item.asset.default}
							title={item.title || item.id}
						/>
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
								{translator.textFn("Edit")}
							</PrimaryButtonLink>
						</div>
					}
				/>
			}
		>
			{children}
		</EditorSectionPage>
	);
};

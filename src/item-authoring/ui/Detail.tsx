import { ItemHeaderTitle } from "~/item-authoring/ui/ItemHeaderTitle";
import { Pencil } from "lucide-react";
import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { PrimaryButtonLink } from "~/ui/ui/Button";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorSectionBar } from "~/authoring-shell/ui/EditorSectionBar";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { useTranslator } from "~/translation/ui/useTranslator";
import { useEditorEditShortcut } from "~/authoring-shell/ui/useEditorEditShortcut";
import { NotFound } from "~/item-authoring/ui/NotFound";
import { SectionLink } from "~/item-authoring/ui/SectionLink";
import type { SectionId } from "~/item-authoring/type/Section";
import { readSectionsFn } from "~/item-authoring/fn/readSectionsFn";
import { useItemByUid } from "~/item-authoring/ui/useItemByUid";
import { ItemDraftToggle } from "~/item-authoring/ui/ItemDraftToggle";
import { ItemSectionHelp } from "~/item-authoring/ui/ItemSectionHelp";
import { useItemSectionShortcuts } from "~/item-authoring/ui/useItemSectionShortcuts";

const showSectionHeadingFn = (sectionId: SectionId) => {
	switch (sectionId) {
		case "merges":
		case "units":
		case "clock":
		case "chain":
		case "connections":
		case "notes":
		case "delete":
			return false;
		default:
			return true;
	}
};

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
	const translator = useTranslator();
	const editActionRef = useEditorEditShortcut();
	const item = useItemByUid(uid);
	const sections = readSectionsFn();
	useItemSectionShortcuts({
		enabled: item !== undefined,
		itemUid: item?.uid ?? uid,
		projectId: project.projectId,
		sections,
	});
	if (item === undefined) return <NotFound uid={uid} />;
	const params = {
		projectId: project.projectId,
		itemUid: item.uid,
	};
	const editableSectionId = readSectionsFn("form").some((section) => section.id === sectionId)
		? sectionId
		: "identity";
	const help = ItemSectionHelp[sectionId];
	const section = sections.find((candidate) => candidate.id === sectionId);
	const sectionTitle =
		sectionId === "identity"
			? translator.textFn("Item details")
			: sectionId === "delete"
				? translator.textFn("Delete item")
				: translator.textFn(section?.label ?? "Item details");
	const sectionHeading = !showSectionHeadingFn(sectionId) ? null : (
		<EditorFormSectionDivider title={sectionTitle} />
	);
	return (
		<EditorSectionPage
			contentClassName="mx-auto w-3/4"
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
							resourceUids={item.artwork.default}
							title={item.title || item.uid}
						/>
					}
					action={
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
					}
				/>
			}
			secondaryNavigation={
				<EditorSectionBar
					actions={<ItemDraftToggle item={item} />}
					help={help === undefined ? undefined : <EditorPageHelp {...help} />}
				>
					{sections.map((section) => (
						<SectionLink
							destination="detail"
							itemUid={item.uid}
							key={section.id}
							projectId={project.projectId}
							section={section}
						/>
					))}
				</EditorSectionBar>
			}
		>
			{sectionId === "notes" ? (
				<div
					className="grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)]"
					data-ui="EditorItemDetailPageContent"
				>
					{children}
				</div>
			) : sectionId === "connections" ? (
				<div
					className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)]"
					data-ui="EditorItemDetailPageContent"
				>
					{children}
				</div>
			) : (
				<div
					className="grid min-w-0 content-start gap-[var(--ak-viewport-gap)]"
					data-ui="EditorItemDetailPageContent"
				>
					{sectionHeading}
					{children}
				</div>
			)}
		</EditorSectionPage>
	);
};

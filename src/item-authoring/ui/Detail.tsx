import { LogIn, LogOut, Pencil, Replace } from "lucide-react";
import type { PropsWithChildren } from "react";
import { Link } from "@tanstack/react-router";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { PrimaryButtonLink } from "~/ui/ui/Button";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp, type EditorPageHelpContent } from "~/authoring-shell/ui/EditorPageHelp";
import {
	EditorSectionNavigation,
	EditorSectionNavigationSeparator,
} from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorSectionTabs } from "~/authoring-shell/ui/EditorSectionTabs";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { useEditorEditShortcut } from "~/authoring-shell/ui/useEditorEditShortcut";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { TypePresentation } from "~/item-definition/ui/TypePresentation";
import { NotFound } from "~/item-authoring/ui/NotFound";
import { ItemTypeMenu } from "~/item-authoring/ui/ItemTypeMenu";
import { SectionLink } from "~/item-authoring/ui/SectionLink";
import type { SectionId } from "~/item-authoring/type/Section";
import { readSectionsFn } from "~/item-authoring/fn/readSectionsFn";
import { useItemByUid } from "~/item-authoring/ui/useItemByUid";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";

const ItemDetailHelpBySection: Partial<Record<SectionId, EditorPageHelpContent>> = {
	estimate: {
		content: <Mx label="Item estimate help" />,
		title: <Tx label="Estimate" />,
	},
	connections: {
		content: <Mx label="Item connections help" />,
		title: <Tx label="Connections" />,
	},
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
	const editActionRef = useEditorEditShortcut();
	const item = useItemByUid(uid);
	if (item === undefined) return <NotFound uid={uid} />;
	const params = {
		projectId: project.projectId,
		itemUid: item.uid,
	};
	const editableSectionId =
		sectionId === "estimate" || sectionId === "connections" || sectionId === "delete"
			? "identity"
			: sectionId;
	const help = ItemDetailHelpBySection[sectionId];
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
						<h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold">
							<span className="truncate">{item.title || item.id}</span>
							<span className="shrink-0 text-muted">·</span>
							<Link
								className="shrink-0 text-base"
								data-ui="EditorItemType"
								params={{
									projectId: project.projectId,
								}}
								search={{
									itemType: item.type,
								}}
								to="/editor/$projectId/editor/items/list"
							>
								<TypePresentation type={item.type} />
							</Link>
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
							<LinkButtonLink
								className="inline-flex items-center gap-2 px-1 text-sm"
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
							</LinkButtonLink>
							<LinkButtonLink
								className="inline-flex items-center gap-2 px-1 text-sm"
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
							</LinkButtonLink>
							{help === undefined ? null : <EditorPageHelp {...help} />}
							<EditorSectionNavigationSeparator />
							<ItemTypeMenu
								dataUi="EditorItemConvertMenu"
								description="Compatible data is kept; unsupported fields are removed on Save."
								icon={Replace}
								label="Convert"
								projectId={project.projectId}
								readItemUidFn={() => item.uid}
								triggerClassName="h-10 min-h-10 gap-2"
								types={TypeSchema.options.filter((type) => type !== item.type)}
							/>
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
			sectionId === "charges" ||
			sectionId === "delete" ||
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

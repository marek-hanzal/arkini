import { ShortcutLabel } from "~/ui/ui/ShortcutLabel";
import { Mx } from "~/translation/ui/Mx";
import { formatForDisplay } from "@tanstack/react-hotkeys";
import type { ArtworkCatalogFilterSchema } from "~/artwork-authoring/schema/ArtworkCatalogFilterSchema";
import { FileQuestion, PackagePlus, Pencil } from "lucide-react";
import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { PrimaryButtonLink } from "~/ui/ui/Button";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorSectionBar } from "~/authoring-shell/ui/EditorSectionBar";
import { useEditorEditShortcut } from "~/authoring-shell/ui/useEditorEditShortcut";
import { useEditorArtworkByUid } from "~/artwork-authoring/ui/useEditorArtworkByUid";
import { CreateItemLink } from "~/item-authoring/ui/CreateItemLink";
import { ItemHeaderTitle } from "~/item-authoring/ui/ItemHeaderTitle";
import { EditorPageHelp, type EditorPageHelpContent } from "~/authoring-shell/ui/EditorPageHelp";
import { Tx } from "~/translation/ui/Tx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Status } from "~/ui/ui/Status";
import { sectionLinkClassName } from "~/ui/constant/SectionLinkClassName";
import { Tooltip } from "~/ui/ui/Tooltip";
import {
	EditorArtworkDetailSections,
	type EditorArtworkDetailSection,
} from "~/artwork-authoring/type/EditorArtworkDetailSections";
import { useEditorArtworkDetailSectionShortcuts } from "~/artwork-authoring/ui/useEditorArtworkDetailSectionShortcuts";

const EditorArtworkDetailTab = ({
	filter,
	projectId,
	query,
	resourceUid,
	section,
}: {
	readonly filter: ArtworkCatalogFilterSchema.Type;
	readonly projectId: string;
	readonly query: string;
	readonly resourceUid: string;
	readonly section: EditorArtworkDetailSection;
}) => {
	const translator = useTranslator();
	const label = translator.textFn(section.label);
	return (
		<Tooltip
			content={`${label} · ${formatForDisplay({
				key: section.shortcut,
			})}`}
			placement="bottom"
		>
			<LinkButtonLink
				to={section.to}
				params={{
					projectId,
					resourceUid,
				}}
				search={{
					filter,
					query,
				}}
				activeOptions={{
					exact: true,
				}}
				activeProps={{
					"data-ui-selected": true,
				}}
				inactiveProps={{
					"data-ui-selected": false,
				}}
				className={sectionLinkClassName}
			>
				<ShortcutLabel
					label={label}
					shortcut={section.shortcut}
				/>
			</LinkButtonLink>
		</Tooltip>
	);
};

export const EditorArtworkDetail = ({
	children,
	contentMode = "scroll",
	filter,
	help,
	query,
	resourceUid,
}: PropsWithChildren<{
	readonly help: EditorPageHelpContent;
	readonly contentMode?: "scroll" | "viewport";
	readonly filter: ArtworkCatalogFilterSchema.Type;
	readonly query: string;
	readonly resourceUid: string;
}>) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const editActionRef = useEditorEditShortcut();
	const resource = useEditorArtworkByUid(resourceUid);
	useEditorArtworkDetailSectionShortcuts({
		enabled: resource !== undefined,
		filter,
		projectId: project.projectId,
		query,
		resourceUid,
	});
	if (resource === undefined) {
		return (
			<EditorSectionPage
				header={
					<EditorSectionNavigation
						leading={
							<EditorHistoryBackButton
								to="/editor/$projectId/artwork"
								params={{
									projectId: project.projectId,
								}}
								search={{
									filter,
									query,
								}}
							/>
						}
						title={<h1 className="truncate text-xl font-semibold">{resourceUid}</h1>}
					/>
				}
			>
				<Status
					dataUi="EditorArtworkNotFound"
					description={<Mx label="Artwork missing description" />}
					icon={FileQuestion}
					title={translator.textFn("Artwork not found")}
				/>
			</EditorSectionPage>
		);
	}
	return (
		<EditorSectionPage
			contentMode={contentMode}
			header={
				<EditorSectionNavigation
					leading={
						<EditorHistoryBackButton
							to="/editor/$projectId/artwork"
							params={{
								projectId: project.projectId,
							}}
							search={{
								filter,
								query,
							}}
						/>
					}
					title={
						<ItemHeaderTitle
							resourceUids={[
								resource.uid,
							]}
							title={resource.title}
						/>
					}
					action={
						<PrimaryButtonLink
							ref={editActionRef}
							to="/editor/$projectId/artwork/$resourceUid/edit"
							params={{
								projectId: project.projectId,
								resourceUid,
							}}
							search={{
								filter,
								query,
							}}
							className="h-10 min-h-10 gap-2 px-3 py-2 text-sm"
						>
							<Pencil className="size-4" />
							<Tx label="Edit" />
						</PrimaryButtonLink>
					}
				/>
			}
			secondaryNavigation={
				<EditorSectionBar
					actions={
						<Tooltip
							content={`${translator.textFn("Create item")} · ${formatForDisplay({
								key: "c",
							})}`}
							placement="bottom"
						>
							<CreateItemLink
								dataUi="EditorArtworkCreateItem"
								defaultTitle={resource.title}
								projectId={project.projectId}
								resourceUid={resource.uid}
								shortcut="c"
								variant="link"
								className="group/shortcut inline-flex items-center gap-1.5 text-sm text-muted"
							>
								<PackagePlus className="size-4" />
								<ShortcutLabel
									label={translator.textFn("Create item")}
									shortcut="c"
								/>
							</CreateItemLink>
						</Tooltip>
					}
					help={<EditorPageHelp {...help} />}
				>
					{EditorArtworkDetailSections.map((section) => (
						<EditorArtworkDetailTab
							filter={filter}
							key={section.id}
							projectId={project.projectId}
							query={query}
							resourceUid={resourceUid}
							section={section}
						/>
					))}
				</EditorSectionBar>
			}
		>
			{children}
		</EditorSectionPage>
	);
};

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
import { useEditorArtworkById } from "~/artwork-authoring/ui/useEditorArtworkById";
import { readResourceNameFn } from "~/game-config-resource/fn/readResourceNameFn";
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
	resourceId,
	section,
}: {
	readonly filter: ArtworkCatalogFilterSchema.Type;
	readonly projectId: string;
	readonly query: string;
	readonly resourceId: string;
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
					resourceId,
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
				{label}
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
	resourceId,
}: PropsWithChildren<{
	readonly help: EditorPageHelpContent;
	readonly contentMode?: "scroll" | "viewport";
	readonly filter: ArtworkCatalogFilterSchema.Type;
	readonly query: string;
	readonly resourceId: string;
}>) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const editActionRef = useEditorEditShortcut();
	const resource = useEditorArtworkById(resourceId);
	useEditorArtworkDetailSectionShortcuts({
		enabled: resource !== undefined,
		filter,
		projectId: project.projectId,
		query,
		resourceId,
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
						title={<h1 className="truncate text-xl font-semibold">{resourceId}</h1>}
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
							resourceIds={[
								resource.id,
							]}
							title={resource.id}
						/>
					}
					action={
						<PrimaryButtonLink
							ref={editActionRef}
							to="/editor/$projectId/artwork/$resourceId/edit"
							params={{
								projectId: project.projectId,
								resourceId,
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
						<CreateItemLink
							dataUi="EditorArtworkCreateItem"
							defaultDraft
							defaultItemId={resource.id}
							defaultTitle={readResourceNameFn(resource.id)}
							projectId={project.projectId}
							resourceId={resource.id}
							variant="link"
							className="inline-flex items-center gap-1.5 text-sm"
						>
							<PackagePlus className="size-4" /> <Tx label="Create item" />
						</CreateItemLink>
					}
					help={<EditorPageHelp {...help} />}
				>
					{EditorArtworkDetailSections.map((section) => (
						<EditorArtworkDetailTab
							filter={filter}
							key={section.id}
							projectId={project.projectId}
							query={query}
							resourceId={resourceId}
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

import type { AssetCatalogFilterSchema } from "~/asset-authoring/schema/AssetCatalogFilterSchema";
import { FileQuestion, PackagePlus, Pencil } from "lucide-react";
import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { PrimaryButtonLink } from "~/ui/ui/Button";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import {
	editorSectionLinkClassName,
	EditorSectionBar,
} from "~/authoring-shell/ui/EditorSectionBar";
import { useEditorEditShortcut } from "~/authoring-shell/ui/useEditorEditShortcut";
import { useEditorAssetById } from "~/asset-authoring/ui/useEditorAssetById";
import { readAssetNameFn } from "~/asset-authoring/fn/readAssetNameFn";
import { CreateItemLink } from "~/item-authoring/ui/CreateItemLink";
import { ItemHeaderTitle } from "~/item-authoring/ui/ItemHeaderTitle";
import { EditorPageHelp, type EditorPageHelpContent } from "~/authoring-shell/ui/EditorPageHelp";
import { Tx } from "~/translation/ui/Tx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Status } from "~/ui/ui/Status";

type EditorAssetDetailPath =
	| "/editor/$projectId/assets/$resourceId/detail/overview"
	| "/editor/$projectId/assets/$resourceId/detail/usage"
	| "/editor/$projectId/assets/$resourceId/detail/delete"
	| "/editor/$projectId/assets/$resourceId/detail/notes";

const EditorAssetDetailTab = ({
	filter,
	label,
	projectId,
	query,
	resourceId,
	to,
}: {
	readonly filter: AssetCatalogFilterSchema.Type;
	readonly label: string;
	readonly projectId: string;
	readonly query: string;
	readonly resourceId: string;
	readonly to: EditorAssetDetailPath;
}) => (
	<LinkButtonLink
		to={to}
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
		className={editorSectionLinkClassName}
	>
		<Tx label={label} />
	</LinkButtonLink>
);

export const EditorAssetDetail = ({
	children,
	contentMode = "scroll",
	filter,
	help,
	query,
	resourceId,
}: PropsWithChildren<{
	readonly help: EditorPageHelpContent;
	readonly contentMode?: "scroll" | "viewport";
	readonly filter: AssetCatalogFilterSchema.Type;
	readonly query: string;
	readonly resourceId: string;
}>) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const editActionRef = useEditorEditShortcut();
	const resource = useEditorAssetById(resourceId);
	if (resource === undefined) {
		return (
			<EditorSectionPage
				header={
					<EditorSectionNavigation
						leading={
							<EditorHistoryBackButton
								to="/editor/$projectId/assets"
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
					dataUi="EditorAssetNotFound"
					description={translator.textFn("This asset is not present in this project.")}
					icon={FileQuestion}
					title={translator.textFn("Asset not found")}
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
							to="/editor/$projectId/assets"
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
							to="/editor/$projectId/assets/$resourceId/edit"
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
							dataUi="EditorAssetCreateItem"
							defaultDraft
							defaultItemId={resource.id}
							defaultTitle={readAssetNameFn(resource.id)}
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
					<EditorAssetDetailTab
						filter={filter}
						label="Overview"
						projectId={project.projectId}
						query={query}
						resourceId={resourceId}
						to="/editor/$projectId/assets/$resourceId/detail/overview"
					/>
					<EditorAssetDetailTab
						filter={filter}
						label="Usage"
						projectId={project.projectId}
						query={query}
						resourceId={resourceId}
						to="/editor/$projectId/assets/$resourceId/detail/usage"
					/>

					<EditorAssetDetailTab
						filter={filter}
						label="Notes"
						projectId={project.projectId}
						query={query}
						resourceId={resourceId}
						to="/editor/$projectId/assets/$resourceId/detail/notes"
					/>
					<EditorAssetDetailTab
						filter={filter}
						label="Delete"
						projectId={project.projectId}
						query={query}
						resourceId={resourceId}
						to="/editor/$projectId/assets/$resourceId/detail/delete"
					/>
				</EditorSectionBar>
			}
		>
			{children}
		</EditorSectionPage>
	);
};

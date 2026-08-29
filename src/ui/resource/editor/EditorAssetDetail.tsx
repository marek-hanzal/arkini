import { FileQuestion, Pencil } from "lucide-react";
import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/useEditorProject";
import { PrimaryButtonLink } from "~/ui/button/Button";
import { EditorHistoryBackButton } from "~/authoring-shell/navigation/EditorHistoryBackButton";
import { EditorSectionNavigation } from "~/authoring-shell/navigation/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/navigation/EditorSectionPage";
import { EditorSectionTabs } from "~/authoring-shell/navigation/EditorSectionTabs";
import { EditorRootCard } from "~/authoring-shell/navigation/EditorRootCard";
import { useEditorEditShortcut } from "~/authoring-shell/navigation/useEditorEditShortcut";
import { EditorAssetDetailTab } from "~/ui/resource/editor/EditorAssetDetailTab";
import { useEditorAssetById } from "~/ui/resource/editor/useEditorAssetById";
import { Status } from "~/ui/status/Status";

export const EditorAssetDetail = ({
	children,
	filter,
	query,
	resourceId,
}: PropsWithChildren<{
	readonly filter: "all" | "unused";
	readonly query: string;
	readonly resourceId: string;
}>) => {
	const project = useEditorProject();
	const editActionRef = useEditorEditShortcut();
	const resource = useEditorAssetById(resourceId);
	if (resource === undefined) {
		return (
			<Status
				dataUi="EditorAssetNotFound"
				description={`Resource ${resourceId} is not present in this project.`}
				icon={FileQuestion}
				title="Asset not found"
				action={
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
			/>
		);
	}
	return (
		<EditorSectionPage
			tabs={
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
					title={<h1 className="truncate text-xl font-semibold">{resource.id}</h1>}
					tabs={
						<EditorSectionTabs label="Asset sections">
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
								label="Technical"
								projectId={project.projectId}
								query={query}
								resourceId={resourceId}
								to="/editor/$projectId/assets/$resourceId/detail/technical"
							/>
							<EditorAssetDetailTab
								filter={filter}
								label="Delete"
								projectId={project.projectId}
								query={query}
								resourceId={resourceId}
								to="/editor/$projectId/assets/$resourceId/detail/delete"
							/>
						</EditorSectionTabs>
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
							className="min-h-0 gap-2 px-4 py-2 text-sm"
						>
							<Pencil
								className="size-4"
								aria-hidden="true"
							/>
							Edit
						</PrimaryButtonLink>
					}
				/>
			}
		>
			<EditorRootCard dataUi="EditorAssetDetailCard">{children}</EditorRootCard>
		</EditorSectionPage>
	);
};

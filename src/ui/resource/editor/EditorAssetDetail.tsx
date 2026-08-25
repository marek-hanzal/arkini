import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { PrimaryButtonLink } from "~/ui/button/Button";
import { EditorHistoryBackButton } from "~/ui/editor/EditorHistoryBackButton";
import { EditorSectionNavigation } from "~/ui/editor/EditorSectionNavigation";
import { EditorSectionPage } from "~/ui/editor/EditorSectionPage";
import { EditorSectionTabs } from "~/ui/editor/EditorSectionTabs";
import { EditorRootCard } from "~/ui/editor/EditorRootCard";
import { useEditorEditShortcut } from "~/ui/editor/useEditorEditShortcut";
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
				icon="icon-[lucide--file-question]"
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
							<span
								className="icon-[lucide--pencil] size-4"
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

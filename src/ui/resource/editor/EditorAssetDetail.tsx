import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { ButtonLink } from "~/ui/button/Button";
import { EditorSectionPage } from "~/ui/editor/EditorSectionPage";
import { EditorSectionTabs } from "~/ui/editor/EditorSectionTabs";
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
	const resource = useEditorAssetById(resourceId);
	if (resource === undefined) {
		return (
			<Status
				dataUi="EditorAssetNotFound"
				description={`Resource ${resourceId} is not present in this project.`}
				icon="icon-[lucide--file-question]"
				title="Asset not found"
				action={
					<ButtonLink
						to="/editor/$projectId/assets"
						params={{
							projectId: project.projectId,
						}}
						search={{
							filter,
							query,
						}}
						className="gap-2"
					>
						<span
							className="icon-[lucide--arrow-left] size-4"
							aria-hidden="true"
						/>
						Back
					</ButtonLink>
				}
			/>
		);
	}
	return (
		<EditorSectionPage
			tabs={
				<div className="grid gap-3">
					<header className="flex min-w-0 flex-wrap items-center gap-3">
						<ButtonLink
							to="/editor/$projectId/assets"
							params={{
								projectId: project.projectId,
							}}
							search={{
								filter,
								query,
							}}
							className="min-h-0 shrink-0 gap-2 px-3 py-2 text-sm"
						>
							<span
								className="icon-[lucide--arrow-left] size-4"
								aria-hidden="true"
							/>
							Back
						</ButtonLink>
						<div className="min-w-0">
							<h1 className="truncate text-xl font-semibold">{resource.id}</h1>
							<p className="mt-1 text-sm text-muted">Asset detail</p>
						</div>
					</header>
					<EditorSectionTabs label="Asset detail sections">
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
				</div>
			}
		>
			{children}
		</EditorSectionPage>
	);
};

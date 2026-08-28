import { Unlink } from "lucide-react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { useEditorResourceUsages } from "~/bridge/resource/editor/useEditorResourceUsages";
import { ButtonLink } from "~/ui/button/Button";
import { Status } from "~/ui/status/Status";

export const EditorAssetUsage = ({ resourceId }: { readonly resourceId: string }) => {
	const project = useEditorProject();
	const usages = useEditorResourceUsages().filter((usage) => usage.resourceId === resourceId);
	if (usages.length === 0) {
		return (
			<Status
				dataUi="EditorAssetUnused"
				description="No saved project or item currently references this asset."
				icon={Unlink}
				title="This asset is not used"
				variant="flat"
			/>
		);
	}
	return (
		<section
			className="ak-list grid gap-2"
			aria-label="Asset usage"
		>
			{usages.map((usage) => {
				const content = (
					<>
						<span className="min-w-0 flex-1">
							<span className="block truncate font-semibold">{usage.ownerLabel}</span>
							<span className="mt-1 block text-xs text-muted">{usage.roleLabel}</span>
						</span>
						<span className="text-xs uppercase tracking-wide text-subtle">
							{usage.owner}
						</span>
					</>
				);
				return usage.owner === "item" ? (
					<ButtonLink
						key={`${usage.ownerId}:${usage.roleLabel}`}
						to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
						params={{
							projectId: project.projectId,
							itemUid: usage.ownerUid,
							sectionId: "artwork",
						}}
						className="ak-list-row ak-list-row-interactive min-h-0 min-w-0 justify-start gap-3 border-0 p-4 text-left shadow-none"
					>
						{content}
					</ButtonLink>
				) : (
					<div
						key={`project:${usage.roleLabel}`}
						className="ak-list-row flex min-w-0 items-center gap-3 rounded-lg p-4"
					>
						{content}
					</div>
				);
			})}
		</section>
	);
};

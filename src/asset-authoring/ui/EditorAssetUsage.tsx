import { Unlink } from "lucide-react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useEditorResourceUsages } from "~/asset-authoring/ui/useEditorResourceUsages";
import { Status } from "~/ui/ui/Status";
import { EditorAssetUsageRow } from "~/asset-authoring/ui/EditorAssetUsageRow";

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
			data-ui="EditorAssetUsage"
		>
			{usages.map((usage) => (
				<EditorAssetUsageRow
					dataUi="EditorAssetUsageRow"
					key={`${usage.owner}:${usage.path.join(".")}`}
					project={project}
					trailing={
						<span className="text-xs uppercase tracking-wide text-subtle">
							{usage.owner}
						</span>
					}
					usage={usage}
				/>
			))}
		</section>
	);
};

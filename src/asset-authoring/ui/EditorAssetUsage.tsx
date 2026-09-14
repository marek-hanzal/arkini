import { useTranslator } from "~/translation/ui/useTranslator";
import { Unlink } from "lucide-react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useEditorResourceUsages } from "~/asset-authoring/ui/useEditorResourceUsages";
import { Mx } from "~/translation/ui/Mx";
import { Status } from "~/ui/ui/Status";
import { EditorAssetUsageRow } from "~/asset-authoring/ui/EditorAssetUsageRow";

export const EditorAssetUsage = ({ resourceId }: { readonly resourceId: string }) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const usages = useEditorResourceUsages().filter((usage) => usage.resourceId === resourceId);
	if (usages.length === 0) {
		return (
			<Status
				dataUi="EditorAssetUnused"
				description={<Mx label="Asset usage empty description" />}
				icon={Unlink}
				size="large"
				title={translator.textFn("This asset is not used")}
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

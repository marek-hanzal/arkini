import { useTranslator } from "~/translation/ui/useTranslator";
import { Unlink } from "lucide-react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useEditorResourceUsages } from "~/artwork-authoring/ui/useEditorResourceUsages";
import { Mx } from "~/translation/ui/Mx";
import { Status } from "~/ui/ui/Status";
import { EditorArtworkUsageRow } from "~/artwork-authoring/ui/EditorArtworkUsageRow";

export const EditorArtworkUsage = ({ resourceUid }: { readonly resourceUid: string }) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const usages = useEditorResourceUsages().filter((usage) => usage.resourceUid === resourceUid);
	if (usages.length === 0) {
		return (
			<Status
				dataUi="EditorArtworkUnused"
				description={<Mx label="Artwork usage empty description" />}
				icon={Unlink}
				size="large"
				title={translator.textFn("This artwork is not used")}
				variant="flat"
			/>
		);
	}
	return (
		<section
			className="ak-list grid gap-2"
			data-ui="EditorArtworkUsage"
		>
			{usages.map((usage) => (
				<EditorArtworkUsageRow
					dataUi="EditorArtworkUsageRow"
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

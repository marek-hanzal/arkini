import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import {
	DetailFact,
	DetailFacts,
	DetailSection,
} from "~/ui/item/editor/EditorItemDetailDefinition";
import { EditorProductionLineInputs } from "~/ui/item/editor/EditorProductionLineInputs";

/** Presents the authored Space target and immediate action requirements. */
export const EditorSpaceActionDetail = ({ item }: { readonly item: EditorItem }) => {
	const project = useEditorProject();
	if (item.type !== "space") return null;
	return (
		<div className="grid gap-6">
			<DetailSection
				description="Activation settles every requirement before entering the target."
				title="Space action"
			>
				<DetailFacts>
					<DetailFact
						label="Target space"
						value={item.space}
					/>
					<DetailFact
						label="Availability"
						value={item.enable ? "Enabled" : "Disabled"}
					/>
					<DetailFact
						label="Rules"
						value={item.rules.length}
					/>
				</DetailFacts>
			</DetailSection>
			<EditorProductionLineInputs
				emptyLabel="No additional action requirements."
				input={item.input}
				items={project.config.items}
				projectId={project.projectId}
				title="Requirements"
			/>
		</div>
	);
};

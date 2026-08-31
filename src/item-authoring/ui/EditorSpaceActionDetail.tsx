import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import {
	DetailFact,
	DetailFacts,
	DetailSection,
} from "~/item-authoring/ui/EditorItemDetailDefinition";
import { EditorProductionLineInputs } from "~/item-authoring/ui/EditorProductionLineInputs";

/** Presents the authored Space target and immediate action requirements. */
export const EditorSpaceActionDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
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

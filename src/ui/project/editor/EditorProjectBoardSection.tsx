import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { useEditorProjectFormSession } from "~/ui/project/editor/EditorProjectFormContext";

export const EditorProjectBoardSection = () => {
	const { form } = useEditorProjectFormSession();
	return (
		<EditorFormSection
			title="Board"
			description="The dimensions of every playable board space. Initial placements must remain inside these bounds."
		>
			<div className="grid gap-4 md:grid-cols-2">
				<form.AppField name="board.width">
					{(field) => (
						<field.NumberField
							label="Width"
							min={1}
						/>
					)}
				</form.AppField>
				<form.AppField name="board.height">
					{(field) => (
						<field.NumberField
							label="Height"
							min={1}
						/>
					)}
				</form.AppField>
			</div>
		</EditorFormSection>
	);
};

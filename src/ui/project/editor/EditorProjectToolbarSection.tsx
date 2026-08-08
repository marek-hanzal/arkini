import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { useEditorProjectFormSession } from "~/ui/project/editor/EditorProjectFormContext";

export const EditorProjectToolbarSection = () => {
	const { form } = useEditorProjectFormSession();
	return (
		<EditorFormSection
			title="Toolbar"
			description="The one-row passive toolbar. Set its size to zero to disable it."
		>
			<form.AppField name="toolbarSize">
				{(field) => (
					<field.NumberField
						label="Slots"
						min={0}
						max={64}
					/>
				)}
			</form.AppField>
		</EditorFormSection>
	);
};

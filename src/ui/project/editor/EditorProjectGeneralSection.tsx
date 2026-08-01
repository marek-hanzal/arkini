import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { useEditorProjectFormSession } from "~/ui/project/editor/EditorProjectFormContext";

export const EditorProjectGeneralSection = () => {
	const { form } = useEditorProjectFormSession();
	return (
		<EditorFormSection
			title="General"
			description="Player-facing project metadata."
		>
			<form.AppField name="title">
				{(field) => <field.TextField label="Title" />}
			</form.AppField>
		</EditorFormSection>
	);
};

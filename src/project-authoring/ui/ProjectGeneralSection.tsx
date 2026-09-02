import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { useProjectFormSession } from "~/project-authoring/ui/ProjectFormContext";

export const ProjectGeneralSection = () => {
	const { form } = useProjectFormSession();
	return (
		<EditorFormSection title="General">
			<EditorFormCard>
				<form.AppField name="title">
					{(field) => <field.TextField label="Title" />}
				</form.AppField>
			</EditorFormCard>
		</EditorFormSection>
	);
};

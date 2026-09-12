import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { useTranslator } from "~/translation/ui/useTranslator";
import { useProjectFormSession } from "~/project-authoring/ui/ProjectFormContext";

export const ProjectGeneralSection = () => {
	const { form } = useProjectFormSession();
	const translator = useTranslator();
	return (
		<>
			<EditorFormCard>
				<form.AppField name="title">
					{(field) => <field.TextField label={translator.textFn("Title")} />}
				</form.AppField>
			</EditorFormCard>
		</>
	);
};

import { EditorProjectSizeMax } from "~/project-authoring/schema/ProjectFormSchema";
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
				<div className="grid grid-cols-2 gap-4">
					<form.AppField name="board.width">
						{(field) => (
							<field.NumberField
								label={translator.textFn("Default board width")}
								min={1}
								max={EditorProjectSizeMax}
							/>
						)}
					</form.AppField>
					<form.AppField name="board.height">
						{(field) => (
							<field.NumberField
								label={translator.textFn("Default board height")}
								min={1}
								max={EditorProjectSizeMax}
							/>
						)}
					</form.AppField>
				</div>
			</EditorFormCard>
		</>
	);
};

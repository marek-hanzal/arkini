import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorTextarea } from "~/editor-control/ui/EditorTextarea";
import { useProjectFormSession } from "~/project-authoring/ui/ProjectFormContext";
import { useTranslator } from "~/translation/ui/useTranslator";

export const ProjectIntroductionSection = () => {
	const { form, isSaving } = useProjectFormSession();
	const translator = useTranslator();
	return (
		<EditorFormCard>
			<form.Field name="introduction">
				{(field) => (
					<label
						className="grid gap-2"
						data-ui="ProjectIntroductionSection"
					>
						<span className="font-semibold">{translator.textFn("Introduction")}</span>
						<EditorTextarea
							minRows={20}
							maxRows={null}
							disabled={isSaving}
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.currentTarget.value)}
							placeholder={translator.textFn("Write a welcome in Markdown…")}
						/>
					</label>
				)}
			</form.Field>
		</EditorFormCard>
	);
};

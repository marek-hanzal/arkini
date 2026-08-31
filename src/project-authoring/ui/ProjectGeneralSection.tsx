import { useProjectFormSession } from "~/project-authoring/ui/ProjectFormContext";

export const ProjectGeneralSection = () => {
	const { form } = useProjectFormSession();
	return (
		<div className="grid gap-4">
			<form.AppField name="title">
				{(field) => <field.TextField label="Title" />}
			</form.AppField>
		</div>
	);
};

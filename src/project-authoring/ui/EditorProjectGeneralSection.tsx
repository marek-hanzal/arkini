import { useEditorProjectFormSession } from "~/project-authoring/ui/EditorProjectFormContext";

export const EditorProjectGeneralSection = () => {
	const { form } = useEditorProjectFormSession();
	return (
		<div className="grid gap-4">
			<form.AppField name="title">
				{(field) => <field.TextField label="Title" />}
			</form.AppField>
		</div>
	);
};

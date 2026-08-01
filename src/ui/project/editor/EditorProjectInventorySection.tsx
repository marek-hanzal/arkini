import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { useEditorProjectFormSession } from "~/ui/project/editor/EditorProjectFormContext";

export const EditorProjectInventorySection = () => {
	const { form } = useEditorProjectFormSession();
	return (
		<EditorFormSection
			title="Inventory"
			description="The dimensions of the shared passive inventory grid."
		>
			<div className="grid gap-4 md:grid-cols-2">
				<form.AppField name="inventory.width">
					{(field) => (
						<field.NumberField
							label="Width"
							min={1}
						/>
					)}
				</form.AppField>
				<form.AppField name="inventory.height">
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

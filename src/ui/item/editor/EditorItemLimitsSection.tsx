import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { useEditorItemFormSession } from "~/ui/item/editor/EditorItemFormContext";

export const EditorItemLimitsSection = () => {
	const { canonicalItem, form } = useEditorItemFormSession();
	return (
		<EditorFormSection
			title="Limits"
			description="Configured global and per-stack quantity constraints."
		>
			<div className="grid gap-4 md:grid-cols-2">
				<form.AppField name="maxCount">
					{(field) => (
						<field.NumberField
							label="Maximum global count"
							description="Leave empty for no global limit."
							min={1}
							optional
						/>
					)}
				</form.AppField>
				{canonicalItem.type === "temporary" ? null : (
					<form.AppField name="maxStackSize">
						{(field) => <field.NumberField label="Maximum stack size" min={1} />}
					</form.AppField>
				)}
			</div>
		</EditorFormSection>
	);
};

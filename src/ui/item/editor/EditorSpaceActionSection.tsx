import { CircleCheck, CircleX } from "lucide-react";

import type { InputSchema as ActionInputSchema } from "~/engine/action/schema/InputSchema";
import type { RuleSchema as ActionRuleSchema } from "~/engine/action/schema/RuleSchema";
import { EditorFormCard } from "~/ui/form/EditorFormCard";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { useEditorItemFormSession } from "~/ui/item/editor/EditorItemFormContext";
import { EditorLineInputsControl } from "~/ui/item/editor/EditorLineInputsControl";
import { EditorRulesControl } from "~/ui/item/editor/EditorRulesControl";

/** Authors one immediate Space action through the shared input and availability controls. */
export const EditorSpaceActionSection = () => {
	const { canonicalItem, form } = useEditorItemFormSession();
	if (canonicalItem.type !== "space") return null;
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormCard>
				<EditorFormSectionDivider
					description="Activating this item settles its configured requirements and charge costs, then enters the authored target space in the same engine transaction."
					title="Space action"
					variant="secondary"
				/>
				<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
					<form.AppField name="space">
						{(field) => (
							<field.NumberField
								description="The board space entered after successful activation. One-way navigation is allowed."
								label="Target space"
								min={0}
							/>
						)}
					</form.AppField>
					<form.AppField name="enable">
						{(field) => (
							<field.BoolToggle
								checkedIcon={CircleCheck}
								description="Enabled actions may activate before availability rules are applied."
								label="Enabled"
								uncheckedIcon={CircleX}
							/>
						)}
					</form.AppField>
				</div>
			</EditorFormCard>
			<EditorFormCard>
				<form.Subscribe selector={(state) => state.values.rules ?? []}>
					{(rules) => (
						<EditorRulesControl
							allowedTypes={[
								"enable",
								"disable",
							]}
							description="These rules gate only this Space action. Every Enable rule must pass, and any matching Disable rule vetoes activation."
							rules={rules}
							target="action"
							onChange={(next) =>
								form.setFieldValue("rules", next as ActionRuleSchema.Type[])
							}
						/>
					)}
				</form.Subscribe>
			</EditorFormCard>
			<EditorFormCard>
				<form.Subscribe selector={(state) => state.values.input ?? []}>
					{(input) => (
						<EditorLineInputsControl
							allowMaterials={false}
							emptyAllowed
							value={input}
							onChange={(next) =>
								form.setFieldValue(
									"input",
									next.filter(
										(candidate): candidate is ActionInputSchema.Type =>
											candidate.type !== "materials",
									),
								)
							}
						/>
					)}
				</form.Subscribe>
			</EditorFormCard>
		</div>
	);
};

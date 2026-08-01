import { Button } from "~/ui/button/Button";
import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { useEditorItemFormSession } from "~/ui/item/editor/EditorItemFormContext";
import { EditorOptionalOutputControl } from "~/ui/item/editor/EditorOptionalOutputControl";

export const EditorItemChargesSection = () => {
	const { form } = useEditorItemFormSession();
	return (
		<EditorFormSection
			title="Charges"
			description="Optional finite lifetime shared by every fresh instance."
		>
			<form.Subscribe selector={(state) => state.values.charges}>
				{(charges) =>
					charges === undefined ? (
						<Button
							className="justify-self-start"
							onClick={() =>
								form.setFieldValue("charges", {
									amount: 1,
								})
							}
						>
							Enable charges
						</Button>
					) : (
						<div className="grid gap-4">
							<div className="flex items-end gap-3">
								<div className="min-w-0 flex-1">
									<form.AppField name="charges.amount">
										{(field) => (
											<field.NumberField
												label="Initial charges"
												min={1}
											/>
										)}
									</form.AppField>
								</div>
								<Button onClick={() => form.setFieldValue("charges", undefined)}>
									Disable
								</Button>
							</div>
							<EditorOptionalOutputControl
								addLabel="Add depletion output"
								removeLabel="Remove output"
								value={charges.output}
								onChange={(output) => form.setFieldValue("charges.output", output)}
							/>
						</div>
					)
				}
			</form.Subscribe>
		</EditorFormSection>
	);
};

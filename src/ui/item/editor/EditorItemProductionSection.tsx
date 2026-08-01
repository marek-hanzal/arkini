import { match } from "ts-pattern";

import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { useEditorItemFormSession } from "~/ui/item/editor/EditorItemFormContext";
import { EditorLineFields } from "~/ui/item/editor/EditorLineField";
import { EditorOptionalOutputControl } from "~/ui/item/editor/EditorOptionalOutputControl";
import { EditorProductionFields } from "~/ui/item/editor/EditorProductionFields";

export const EditorItemProductionSection = () => {
	const { canonicalItem, form, itemId } = useEditorItemFormSession();
	return match(canonicalItem)
		.with(
			{
				type: "deposit",
			},
			() => (
				<EditorProductionFields
					form={form}
					fields={{
						maxQueueSize: "maxQueueSize",
						lines: "lines",
					}}
					kind="deposit"
					ownerId={itemId}
				/>
			),
		)
		.with(
			{
				type: "producer",
			},
			() => (
				<EditorProductionFields
					form={form}
					fields={{
						maxQueueSize: "maxQueueSize",
						lines: "lines",
					}}
					kind="producer"
					ownerId={itemId}
				/>
			),
		)
		.with(
			{
				type: "temporary",
			},
			() => (
				<EditorFormSection title="Temporary lifetime">
					<form.AppField name="durationMs">
						{(field) => (
							<field.NumberField
								label="Duration (milliseconds)"
								min={500}
							/>
						)}
					</form.AppField>
					<form.Subscribe
						selector={(state) =>
							state.values.type === "temporary" ? state.values.output : undefined
						}
					>
						{(output) => (
							<EditorOptionalOutputControl
								addLabel="Add expiry output"
								removeLabel="Remove expiry output"
								value={output}
								onChange={(next) => form.setFieldValue("output", next)}
							/>
						)}
					</form.Subscribe>
				</EditorFormSection>
			),
		)
		.with(
			{
				type: "blueprint",
			},
			{
				type: "craft",
			},
			{
				type: "stash",
			},
			() => (
				<EditorFormSection
					title="Product line"
					description="Inputs, outputs and base behavior owned by this item."
				>
					<EditorLineFields
						form={form}
						fields="line"
						label="Product line"
					/>
				</EditorFormSection>
			),
		)
		.with(
			{
				type: "inventory",
			},
			{
				type: "simple",
			},
			() => null,
		)
		.exhaustive();
};

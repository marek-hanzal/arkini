import { match } from "ts-pattern";

import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { EditorFormCard } from "~/ui/form/EditorFormCard";
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
				<EditorFormCard>
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
									addLabel="Enable expiry output"
									emptyDescription="Without an output, the temporary item simply disappears when its duration ends. Enable one to emit configured items at expiry."
									emptyIcon="icon-[lucide--package-plus]"
									emptyTitle="No expiry output"
									value={output}
									onChange={(next) => form.setFieldValue("output", next)}
								/>
							)}
						</form.Subscribe>
					</EditorFormSection>
				</EditorFormCard>
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
				<EditorLineFields
					form={form}
					fields="line"
					label="Product line"
				/>
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

import { PackagePlus } from "lucide-react";
import { match } from "ts-pattern";

import { EditorFormCard } from "~/ui/form/EditorFormCard";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { useEditorItemFormSession } from "~/item-authoring/ui/EditorItemFormContext";
import { EditorLineFields } from "~/item-authoring/ui/EditorLineField";
import { EditorOptionalOutputControl } from "~/item-authoring/ui/EditorOptionalOutputControl";
import { EditorProductionFields } from "~/item-authoring/ui/EditorProductionFields";

export const EditorItemProductionSection = () => {
	const { canonicalItem, form, itemId, productionLineId } = useEditorItemFormSession();
	const content = match(canonicalItem)
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
					selectedLineId={productionLineId}
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
					selectedLineId={productionLineId}
				/>
			),
		)
		.with(
			{
				type: "temporary",
			},
			() => (
				<div className="grid gap-[var(--ak-viewport-gap)]">
					<EditorFormCard>
						<EditorFormSectionDivider
							description="How long this temporary item remains active before expiring."
							title="Temporary lifetime"
							variant="secondary"
						/>
						<form.AppField name="durationMs">
							{(field) => <field.SecondsField label="Duration (seconds)" />}
						</form.AppField>
					</EditorFormCard>
					<EditorFormSectionDivider
						description="Optional items emitted when the temporary item expires."
						title="Expiry output"
					/>
					<EditorFormCard>
						<form.Subscribe
							selector={(state) =>
								state.values.type === "temporary" ? state.values.output : undefined
							}
						>
							{(output) => (
								<EditorOptionalOutputControl
									addLabel="Enable expiry output"
									emptyDescription="Without an output, the temporary item simply disappears when its duration ends. Enable one to emit configured items at expiry."
									emptyIcon={PackagePlus}
									emptyTitle="No expiry output"
									value={output}
									onChange={(next) => form.setFieldValue("output", next)}
								/>
							)}
						</form.Subscribe>
					</EditorFormCard>
				</div>
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
			{
				type: "space",
			},
			() => null,
		)
		.exhaustive();
	if (content === null) return null;
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormSectionDivider
				description="Defines this item's timed behavior, including concurrency, production lines, inputs, outputs, runtime and rules where supported."
				title="Production"
			/>
			{content}
		</div>
	);
};

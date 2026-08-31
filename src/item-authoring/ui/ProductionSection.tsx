import { Factory, PackagePlus } from "lucide-react";
import { match } from "ts-pattern";

import { useFormSession } from "~/item-authoring/ui/FormContext";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { LineFields } from "~/production-authoring/ui/LineFields";
import { OptionalOutputControl } from "~/production-authoring/ui/OptionalOutputControl";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { withFieldGroup } from "~/authoring-form/ui/EditorForm";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";

interface ProductionFieldValues {
	readonly maxQueueSize?: number;
	readonly lines: Array<LineSchema.Type> | undefined;
}

const defaultProductionFieldValues: ProductionFieldValues = {
	maxQueueSize: 1,
	lines: undefined,
};

const ProductionFields = withFieldGroup({
	defaultValues: defaultProductionFieldValues,
	props: {
		kind: "producer" as "deposit" | "producer",
		ownerId: "",
		selectedLineId: undefined as string | undefined,
	},
	render: ({ group, kind, ownerId, selectedLineId }) => (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormCard>
				<group.AppField name="maxQueueSize">
					{(field) => (
						<field.NumberField
							label="Maximum parallel jobs"
							description="Maximum number of jobs this item may run concurrently across its production lines."
							min={1}
						/>
					)}
				</group.AppField>
			</EditorFormCard>
			<EditorFormSectionDivider
				description={
					kind === "deposit"
						? "Optional self-consuming jobs exposed by this deposit. Each production line is an independent job contract with its own inputs, output, runtime and rules."
						: "Each product line is an independent job contract owned by this producer, with its own inputs, output, runtime and rules."
				}
				title={kind === "deposit" ? "Production lines" : "Product lines"}
			/>
			<group.AppField
				name="lines"
				mode="array"
			>
				{(linesField) => {
					const lines = linesField.state.value ?? [];
					const addLine = () => {
						const lineOwnerId =
							ownerId.replace(/^(?:item|producer):/, "") || "new-item";
						const lineIdPrefix = `line:${lineOwnerId}`;
						const existingIds = new Set(lines.map((line) => line.id));
						let id = `${lineIdPrefix}:default`;
						if (lines.length > 0 || existingIds.has(id)) {
							let suffix = 2;
							while (existingIds.has(`${lineIdPrefix}:${suffix}`)) suffix += 1;
							id = `${lineIdPrefix}:${suffix}`;
						}
						const line: LineSchema.Type = {
							id,
							title: `New ${kind} line`,
							description: `Describe what this ${kind} line consumes and produces.`,
							default: lines.length === 0,
							show: true,
							enable: true,
							runtimeMs: 0,
							input: [
								{
									type: "simple",
								},
							],
							rules: [],
						};
						if (linesField.state.value === undefined) {
							group.setFieldValue("lines", [
								line,
							]);
							return;
						}
						linesField.pushValue(line);
					};
					if (kind === "deposit" && lines.length === 0)
						return (
							<div>
								<EditorCapabilityStatus
									actionLabel="Enable production lines"
									description="This deposit currently only supplies matching deposit inputs. Production lines add self-consuming jobs that can transform the deposit and emit outputs."
									icon={Factory}
									onEnable={addLine}
									title="Production lines are disabled"
								/>
							</div>
						);
					return (
						<EditorCollectionSelector
							addLabel="Add line"
							count={lines.length}
							itemLabel={(index) => {
								const line = lines[index];
								return line.title.length === 0
									? line.id
									: `${line.id} — ${line.title}`;
							}}
							initialSelectedIndex={Math.max(
								0,
								lines.findIndex((line) => line.id === selectedLineId),
							)}
							label={`${kind === "deposit" ? "Production" : "Product"} lines`}
							navigationCard
							onAdd={addLine}
							onRemove={
								kind === "producer" && lines.length === 1
									? undefined
									: (index) => {
											if (kind === "deposit" && lines.length === 1) {
												group.setFieldValue("lines", undefined);
												return;
											}
											linesField.removeValue(index);
										}
							}
							removeLabel="Remove line"
						>
							{(index) => (
								<LineFields
									form={group}
									fields={`lines[${index}]`}
									label={null}
								/>
							)}
						</EditorCollectionSelector>
					);
				}}
			</group.AppField>
		</div>
	),
});

export const ProductionSection = () => {
	const { canonicalItem, form, itemId, productionLineId } = useFormSession();
	const content = match(canonicalItem)
		.with(
			{
				type: "deposit",
			},
			() => (
				<ProductionFields
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
				<ProductionFields
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
								<OptionalOutputControl
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
				<LineFields
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

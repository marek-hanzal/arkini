import { CircleCheck, CircleX, Factory, PackagePlus } from "lucide-react";
import { match } from "ts-pattern";

import { useFormSession } from "~/item-authoring/ui/FormContext";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { LineFields } from "~/production-authoring/ui/LineFields";
import type { RuleSchema } from "~/production-action/schema/RuleSchema";
import { RulesControl } from "~/production-authoring/ui/RulesControl";
import { OptionalOutputControl } from "~/production-authoring/ui/OptionalOutputControl";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { withFieldGroupFn } from "~/authoring-form/ui/EditorForm";
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

const ProductionFields = withFieldGroupFn({
	defaultValues: defaultProductionFieldValues,
	props: {
		invalidLineIndex: undefined as number | undefined,
		kind: "producer" as "deposit" | "producer" | "clock",
		ownerId: "",
		selectedLineId: undefined as string | undefined,
	},
	render: ({ group, invalidLineIndex, kind, ownerId, selectedLineId }) => (
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
						: "Each product line is an independent job contract owned by this item, with its own inputs, output, runtime and rules."
				}
				title={kind === "deposit" ? "Production lines" : "Product lines"}
			/>
			<group.AppField
				name="lines"
				mode="array"
			>
				{(linesField) => {
					const lines = linesField.state.value ?? [];
					const addLineFn = () => {
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
									onEnableFn={addLineFn}
									title="Production lines are disabled"
								/>
							</div>
						);
					return (
						<EditorCollectionSelector
							addLabel="Add line"
							count={lines.length}
							itemLabelFn={(index) => {
								const line = lines[index];
								return line.title.length === 0
									? `Production line ${index + 1}`
									: line.title;
							}}
							itemSearchTermsFn={(index) => [
								lines[index].id,
							]}
							initialSelectedIndex={Math.max(
								0,
								lines.findIndex((line) => line.id === selectedLineId),
							)}
							selectedIndex={invalidLineIndex}
							label={`${kind === "deposit" ? "Production" : "Product"} lines`}
							navigationCard
							onAddFn={addLineFn}
							onRemoveFn={
								kind !== "deposit" && lines.length === 1
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

/** Composes shared time, rule, and output controls for the authored schedule. */
const ClockFields = () => {
	const { form } = useFormSession();
	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorClockFields"
		>
			<EditorFormCard>
				<EditorFormSectionDivider
					title="Clock"
					description="Each enabled interval attempts to queue the current default line. Pausing preserves elapsed time; accepted production keeps its ordinary line rules."
					variant="secondary"
				/>
				<div className="grid grid-cols-2 gap-4">
					<form.AppField name="intervalMs">
						{(field) => (
							<field.SecondsField
								label="Interval (seconds)"
								min={0.1}
							/>
						)}
					</form.AppField>
					<form.AppField name="durationMs">
						{(field) => (
							<field.SecondsField
								label="Lifetime (seconds)"
								description="Leave empty to run indefinitely. Expiry closes admission and waits for production to settle."
								min={0.1}
								optional
							/>
						)}
					</form.AppField>
					<form.AppField name="enable">
						{(field) => (
							<field.BoolToggle
								checkedIcon={CircleCheck}
								uncheckedIcon={CircleX}
								label="Enabled"
								description="Allows the timer to run before availability rules are applied."
							/>
						)}
					</form.AppField>
					<form.AppField name="control">
						{(field) => (
							<field.ChoiceField
								label="Player controls"
								description="Interactive permits timer and production controls. Automatic only uses authored settings."
								options={[
									{
										label: "Automatic only",
										value: "automatic-only",
									},
									{
										label: "Interactive",
										value: "interactive",
									},
								]}
							/>
						)}
					</form.AppField>
				</div>
			</EditorFormCard>
			<EditorFormCard>
				<form.Subscribe selector={(state) => state.values.rules ?? []}>
					{(rules) => (
						<RulesControl
							rules={rules}
							target="action"
							allowedTypes={[
								"enable",
								"disable",
							]}
							description="These rules gate the clock's timer. Every Enable rule must pass and any matching Disable rule vetoes it. Accepted production uses its own line rules."
							onChangeFn={(next) =>
								form.setFieldValue("rules", next as RuleSchema.Type[])
							}
						/>
					)}
				</form.Subscribe>
			</EditorFormCard>
			<EditorFormSectionDivider
				title="Expiry output"
				description="Emitted once after the finite lifetime ends and accepted production has settled."
			/>
			<EditorFormCard>
				<form.Subscribe selector={(state) => state.values.onExpire}>
					{(output) => (
						<OptionalOutputControl
							addLabel="Enable expiry output"
							emptyDescription="Without an output, the clock disappears after expiry and production settlement."
							emptyIcon={PackagePlus}
							emptyTitle="No expiry output"
							value={output}
							onChangeFn={(next) => form.setFieldValue("onExpire", next)}
						/>
					)}
				</form.Subscribe>
			</EditorFormCard>
		</div>
	);
};

export const ProductionSection = () => {
	const { canonicalItem, form, itemId, productionLineId, validationIssues } = useFormSession();
	const invalidLineIndex = validationIssues.find(
		(issue) => issue.path[0] === "lines" && typeof issue.path[1] === "number",
	)?.path[1] as number | undefined;
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
					invalidLineIndex={invalidLineIndex}
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
					invalidLineIndex={invalidLineIndex}
					ownerId={itemId}
					selectedLineId={productionLineId}
				/>
			),
		)
		.with(
			{
				type: "clock",
			},
			() => (
				<div className="grid gap-[var(--ak-viewport-gap)]">
					<ClockFields />
					<ProductionFields
						form={form}
						fields={{
							maxQueueSize: "maxQueueSize",
							lines: "lines",
						}}
						kind="clock"
						invalidLineIndex={invalidLineIndex}
						ownerId={itemId}
						selectedLineId={productionLineId}
					/>
				</div>
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
									onChangeFn={(next) => form.setFieldValue("output", next)}
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
	const temporary = canonicalItem.type === "temporary";
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormSectionDivider
				description={
					temporary
						? "Defines how long this temporary item remains active and what it emits when it expires."
						: "Defines this item's timed behavior, including concurrency, production lines, inputs, outputs, runtime and rules where supported."
				}
				title={temporary ? "Temporary" : "Production"}
			/>
			{content}
		</div>
	);
};

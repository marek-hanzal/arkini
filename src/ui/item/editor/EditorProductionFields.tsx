import { Factory } from "lucide-react";

import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { withFieldGroup } from "~/ui/form/EditorForm";
import { EditorFormCard } from "~/ui/form/EditorFormCard";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorLineFields } from "~/ui/item/editor/EditorLineField";

interface EditorProductionFieldValues {
	readonly maxQueueSize?: number;
	readonly lines: Array<LineSchema.Type> | undefined;
}

const defaultValues: EditorProductionFieldValues = {
	maxQueueSize: 1,
	lines: undefined,
};

/** Shares the queue and registered line-array editor used by deposits and producers. */
export const EditorProductionFields = withFieldGroup({
	defaultValues,
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
								<EditorLineFields
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

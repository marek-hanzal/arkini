import type { EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { withFieldGroup } from "~/ui/form/EditorForm";
import { EditorFormCard } from "~/ui/form/EditorFormCard";
import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import { EditorLineFields } from "~/ui/item/editor/EditorLineField";

interface EditorProductionFieldValues {
	readonly maxQueueSize?: number;
	readonly lines: Array<EditorLine> | undefined;
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
	},
	render: ({ group, kind, ownerId }) => (
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
			<EditorFormCard>
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
							const line: EditorLine = {
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
										icon="icon-[lucide--factory]"
										onEnable={addLine}
										title="Production lines are disabled"
									/>
								</div>
							);
						return (
							<div className="grid gap-4">
								<header>
									<div>
										<div className="flex items-center gap-1">
											<h3 className="text-sm font-semibold">
												{kind === "deposit"
													? "Production lines"
													: "Product lines"}
											</h3>
											<EditorInfoTooltip
												content={
													kind === "deposit"
														? "Each production line is an independent job contract owned by this deposit, with its own inputs, output, runtime and rules."
														: "Each product line is an independent job contract owned by this producer, with its own inputs, output, runtime and rules."
												}
											/>
										</div>
										{kind !== "deposit" ? null : (
											<p className="mt-1 text-xs text-muted">
												Optional self-consuming jobs exposed by this
												deposit.
											</p>
										)}
									</div>
								</header>
								<EditorCollectionSelector
									addLabel="Add line"
									count={lines.length}
									itemLabel={(index) => {
										const line = lines[index];
										return line.title.length === 0
											? line.id
											: `${line.id} — ${line.title}`;
									}}
									label={`${kind === "deposit" ? "Production" : "Product"} lines`}
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
										<div className="grid gap-3">
											<EditorLineFields
												form={group}
												fields={`lines[${index}]`}
												label={null}
											/>
										</div>
									)}
								</EditorCollectionSelector>
							</div>
						);
					}}
				</group.AppField>
			</EditorFormCard>
		</div>
	),
});

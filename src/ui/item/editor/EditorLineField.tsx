import type { EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { withFieldGroup } from "~/ui/form/EditorForm";
import { EditorFormCard } from "~/ui/form/EditorFormCard";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorLineInputsControl } from "~/ui/item/editor/EditorLineInputsControl";
import { EditorOutputControl } from "~/ui/item/editor/EditorOutputControl";
import { EditorRulesControl } from "~/ui/item/editor/EditorRulesControl";

const defaultLine: EditorLine = {
	id: "",
	title: "",
	description: "",
	default: false,
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

/** Edits one line through registered leaf fields while preserving authored rules. */
export const EditorLineFields = withFieldGroup({
	defaultValues: defaultLine,
	props: {
		label: undefined as string | null | undefined,
	},
	render: ({ group, label = "Product line" }) => (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormCard>
				{label === null ? null : (
					<EditorFormSectionDivider
						title={label}
						variant="secondary"
					/>
				)}
				<div className="grid grid-cols-2 items-stretch gap-4">
					<div className="grid content-start gap-3">
						<group.AppField name="id">
							{(field) => <field.TextField label="Line ID" />}
						</group.AppField>
						<group.AppField name="title">
							{(field) => <field.TextField label="Line title" />}
						</group.AppField>
						<group.AppField name="runtimeMs">
							{(field) => (
								<field.SecondsField
									label="Runtime (seconds)"
									description="Base duration of one job on this line before runtime multiplier and adjustment rules are applied."
								/>
							)}
						</group.AppField>
						<div className="flex min-w-0 flex-wrap items-center gap-4">
							<group.AppField name="default">
								{(field) => (
									<field.BoolToggle
										checkedIcon="icon-[lucide--star]"
										description="The default line is selected first when this item starts production."
										label="Default"
										uncheckedIcon="icon-[lucide--star-off]"
									/>
								)}
							</group.AppField>
							<group.AppField name="show">
								{(field) => (
									<field.BoolToggle
										checkedIcon="icon-[lucide--eye]"
										description="Visible lines are shown to the player before runtime rules alter their visibility."
										label="Visible"
										uncheckedIcon="icon-[lucide--eye-off]"
									/>
								)}
							</group.AppField>
							<group.AppField name="enable">
								{(field) => (
									<field.BoolToggle
										checkedIcon="icon-[lucide--circle-check]"
										description="Enabled lines can accept production jobs before runtime rules alter their availability."
										label="Enabled"
										uncheckedIcon="icon-[lucide--circle-x]"
									/>
								)}
							</group.AppField>
						</div>
					</div>
					<group.AppField name="description">
						{(field) => (
							<field.TextAreaField
								fill
								label="Line description"
							/>
						)}
					</group.AppField>
				</div>
			</EditorFormCard>
			<EditorFormCard>
				<group.Subscribe selector={(state) => state.values.rules}>
					{(rules) => (
						<EditorRulesControl
							rules={rules}
							target="line"
							description="These rules belong only to this production line. Every condition inside a rule must pass. Show and hide rules resolve visibility; every enable rule must pass, any disable rule vetoes availability, and runtime rules alter duration. Sibling lines are unaffected."
							allowedTypes={[
								"show",
								"hide",
								"enable",
								"disable",
								"runtime:adjust",
								"runtime:multiplier",
							]}
							onChange={(next) =>
								group.setFieldValue("rules", next as EditorLine["rules"])
							}
						/>
					)}
				</group.Subscribe>
			</EditorFormCard>
			<EditorFormCard className="grid min-w-0 grid-cols-2 gap-0">
				<div className="min-w-0 pr-[var(--ak-panel-padding)]">
					<group.Subscribe selector={(state) => state.values.input}>
						{(input) => (
							<EditorLineInputsControl
								value={input}
								onChange={(next) => group.setFieldValue("input", next)}
							/>
						)}
					</group.Subscribe>
				</div>
				<div className="min-w-0 border-l border-line pl-[var(--ak-panel-padding)]">
					<group.Subscribe selector={(state) => state.values.output}>
						{(output) => (
							<section className="grid min-w-0 content-start gap-3">
								{output === undefined ? (
									<EditorCapabilityStatus
										actionLabel="Enable line output"
										description="This line currently only applies its input and runtime behavior. Enable an output to emit weighted items when the job completes."
										icon="icon-[lucide--package-plus]"
										onEnable={() =>
											group.setFieldValue(
												"output",
												structuredClone(EditorItemDraftDefaults.output),
											)
										}
										title="Line output is disabled"
									/>
								) : (
									<>
										<EditorFormSectionDivider
											description="Optional weighted sets, rolls and item drops belonging only to this production line. They resolve after a completed job and emit the selected item drops."
											title="Output"
											variant="secondary"
										/>
										<EditorOutputControl
											value={output}
											onChange={(next) => group.setFieldValue("output", next)}
										/>
									</>
								)}
							</section>
						)}
					</group.Subscribe>
				</div>
			</EditorFormCard>
		</div>
	),
});

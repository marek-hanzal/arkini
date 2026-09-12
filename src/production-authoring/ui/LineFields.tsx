import { CircleCheck, CircleX, Clock, Eye, EyeOff, PackagePlus, Star, StarOff } from "lucide-react";

import { EditorBooleanToggleBadge } from "~/editor-control/ui/EditorBooleanToggleBadge";
import { useTranslator } from "~/translation/ui/useTranslator";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { withFieldGroupFn } from "~/authoring-form/ui/EditorForm";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { InputsControl } from "~/production-authoring/ui/InputsControl";
import { OutputControl } from "~/production-authoring/ui/OutputControl";
import { RulesControl } from "~/production-authoring/ui/RulesControl";

const defaultLine: LineSchema.Type = {
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
export const LineFields = withFieldGroupFn({
	defaultValues: defaultLine,
	props: {
		label: undefined as string | null | undefined,
		onMarkerChangeFn: undefined as unknown as (
			marker: "default" | "clock",
			value: boolean,
		) => void,
	},
	render: ({ group, label, onMarkerChangeFn }) => {
		const translator = useTranslator();
		return (
			<div className="grid gap-[var(--ak-viewport-gap)]">
				<EditorFormCard>
					{label === null ? null : (
						<EditorFormSectionDivider
							title={label ?? translator.textFn("Product line")}
							variant="secondary"
						/>
					)}
					<div className="grid grid-cols-2 items-stretch gap-4">
						<div className="grid content-start gap-3">
							<group.AppField name="id">
								{(field) => (
									<field.TextField label={translator.textFn("Line ID")} />
								)}
							</group.AppField>
							<group.AppField name="title">
								{(field) => (
									<field.TextField label={translator.textFn("Line title")} />
								)}
							</group.AppField>
							<group.AppField name="runtimeMs">
								{(field) => (
									<field.SecondsField
										label={translator.textFn("Runtime (seconds)")}
										description={translator.textFn(
											"Base duration of one job on this line before runtime multiplier and adjustment rules are applied.",
										)}
									/>
								)}
							</group.AppField>
							<group.AppField name="ahead">
								{(field) => (
									<field.BoolToggle
										checkedIcon={CircleCheck}
										uncheckedIcon={CircleX}
										label={translator.textFn("Check ahead")}
										description={translator.textFn(
											"Before this item is produced, check one future run against item count limits. Only checked lines that are shown and enabled by default participate; one fitting alternative is enough. This looks one step ahead and reserves no future output.",
										)}
									/>
								)}
							</group.AppField>
							<div className="flex min-w-0 flex-wrap items-center gap-4">
								<group.AppField name="default">
									{(field) => (
										<EditorBooleanToggleBadge
											checked={field.state.value}
											checkedIcon={Star}
											uncheckedIcon={StarOff}
											label={translator.textFn("Default")}
											description={translator.textFn(
												"The line selected by default for manual production. Selecting this line clears Default on sibling lines.",
											)}
											onChangeFn={(value) =>
												onMarkerChangeFn("default", value)
											}
										/>
									)}
								</group.AppField>
								<group.AppField name="clock">
									{(field) => (
										<EditorBooleanToggleBadge
											checked={field.state.value === true}
											checkedIcon={Clock}
											uncheckedIcon={Clock}
											label={translator.textFn("Clock")}
											description={translator.textFn(
												"Each clock pulse attempts this line. Selecting this line clears Clock on sibling lines and leaves Default unchanged.",
											)}
											onChangeFn={(value) => onMarkerChangeFn("clock", value)}
										/>
									)}
								</group.AppField>
								<group.AppField name="show">
									{(field) => (
										<field.BoolToggle
											checkedIcon={Eye}
											description={translator.textFn(
												"Visible lines are shown to the player before runtime rules alter their visibility.",
											)}
											label={translator.textFn("Visible")}
											uncheckedIcon={EyeOff}
										/>
									)}
								</group.AppField>
								<group.AppField name="enable">
									{(field) => (
										<field.BoolToggle
											checkedIcon={CircleCheck}
											description={translator.textFn(
												"Enabled lines can accept production jobs before runtime rules alter their availability.",
											)}
											label={translator.textFn("Enabled")}
											uncheckedIcon={CircleX}
										/>
									)}
								</group.AppField>
							</div>
						</div>
						<group.AppField name="description">
							{(field) => (
								<field.TextAreaField
									fill
									label={translator.textFn("Line description")}
								/>
							)}
						</group.AppField>
					</div>
				</EditorFormCard>
				<EditorFormCard>
					<group.Subscribe selector={(state) => state.values.rules}>
						{(rules) => (
							<RulesControl
								rules={rules}
								target="line"
								description={translator.textFn(
									"These rules belong only to this production line. Every condition inside a rule must pass. Show and hide rules resolve visibility; every enable rule must pass, any disable rule vetoes availability, and runtime rules alter duration. Sibling lines are unaffected.",
								)}
								allowedTypes={[
									"show",
									"hide",
									"enable",
									"disable",
									"runtime:adjust",
									"runtime:multiplier",
								]}
								onChangeFn={(next) =>
									group.setFieldValue("rules", next as LineSchema.Type["rules"])
								}
							/>
						)}
					</group.Subscribe>
				</EditorFormCard>
				<div
					className="grid min-w-0 grid-cols-2 gap-0 rounded-2xl border border-l-2 border-line-strong bg-surface-raised/60 p-[var(--ak-panel-padding)]"
					data-ui="EditorFormCard"
				>
					<div className="min-w-0 pr-[var(--ak-panel-padding)]">
						<group.Subscribe selector={(state) => state.values.input}>
							{(input) => (
								<InputsControl
									value={input}
									onChangeFn={(next) =>
										group.setFieldValue(
											"input",
											next as LineSchema.Type["input"],
										)
									}
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
											actionLabel={translator.textFn("Enable line output")}
											description={translator.textFn(
												"This line currently only applies its input and runtime behavior. Enable an output to emit weighted items when the job completes.",
											)}
											icon={PackagePlus}
											onEnableFn={() =>
												group.setFieldValue(
													"output",
													structuredClone(DraftDefaults.output),
												)
											}
											title={translator.textFn(
												"Production line output empty title",
											)}
										/>
									) : (
										<>
											<EditorFormSectionDivider
												description={translator.textFn(
													"Optional weighted sets, rolls and item drops belonging only to this production line. They resolve after a completed job and emit the selected item drops.",
												)}
												title={translator.textFn("Output")}
												variant="secondary"
											/>
											<OutputControl
												value={output}
												onChangeFn={(next) =>
													group.setFieldValue("output", next)
												}
											/>
										</>
									)}
								</section>
							)}
						</group.Subscribe>
					</div>
				</div>
			</div>
		);
	},
});

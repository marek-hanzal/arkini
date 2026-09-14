import { CircleCheck, CircleX, Clock, PackagePlus } from "lucide-react";
import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import type { RuleSchema } from "~/production-action/schema/RuleSchema";
import { useStore } from "@tanstack/react-form";
import { RulesControl } from "~/production-authoring/ui/RulesControl";
import { OptionalOutputControl } from "~/production-authoring/ui/OptionalOutputControl";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { useTranslator } from "~/translation/ui/useTranslator";
/** Composes shared time, rule, and output controls for the authored schedule. */
const ClockFields = () => {
	const translator = useTranslator();
	const { form, ruleIndex, whenIndex, outputDropIndex } = useFormSession();
	const clock = useStore(form.store, (state) => state.values.clock);
	const rulesDescription = translator.textFn(
		"These rules gate the clock's timer. Every Enable rule must pass and any matching Disable rule vetoes it. Accepted production uses its own line rules.",
	);
	if (clock === undefined) return null;
	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorClockFields"
		>
			<EditorFormCard>
				<div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-4">
					<form.AppField name="clock.durationMs">
						{(field) => (
							<field.SecondsField
								label={translator.textFn("Lifetime (seconds)")}
								clearLabel={translator.textFn("Clear lifetime")}
								description={translator.textFn(
									"Leave empty to run indefinitely. Expiry mode controls what happens to unfinished production.",
								)}
								min={5}
								step={5}
								optional
							/>
						)}
					</form.AppField>
					<form.AppField name="clock.intervalMs">
						{(field) => (
							<field.SecondsField
								label={translator.textFn("Interval (seconds)")}
								clearLabel={translator.textFn("Clear interval")}
								description={translator.textFn(
									"Leave empty for a one-shot lifetime without periodic production.",
								)}
								min={5}
								step={5}
								optional
							/>
						)}
					</form.AppField>
					<div className="mt-6.5 flex h-[var(--ak-control-min-height)] w-fit items-center">
						<form.AppField name="clock.enable">
							{(field) => (
								<field.BoolToggle
									checkedIcon={CircleCheck}
									uncheckedIcon={CircleX}
									label={translator.textFn("Enabled")}
									description={translator.textFn(
										"Allows the timer to run before availability rules are applied.",
									)}
								/>
							)}
						</form.AppField>
					</div>
				</div>
				{clock.durationMs === undefined ? null : (
					<EditorChoiceControl
						label={translator.textFn("Expiry mode")}
						value={clock.expiryMode ?? "loose-kill"}
						options={[
							{
								value: "loose-kill",
								label: translator.textFn("Loose-kill"),
								description: translator.textFn(
									"Wait for accepted production to settle. A job blocked on output space keeps this item alive.",
								),
							},
							{
								value: "kill-switch",
								label: translator.textFn("Kill switch"),
								description: translator.textFn(
									"Cancel work and remove the item atomically. Place reserved items first, then unused buffers and expiry output. Anything that does not fit is lost and logged.",
								),
							},
						]}
						onChangeFn={(expiryMode) =>
							form.setFieldValue("clock.expiryMode", expiryMode)
						}
					/>
				)}
			</EditorFormCard>
			<EditorFormSection
				title={translator.textFn("Rules")}
				description={rulesDescription}
			>
				<EditorFormCard>
					<form.Subscribe selector={(state) => state.values.clock?.rules ?? []}>
						{(rules) => (
							<RulesControl
								initialRuleIndex={
									outputDropIndex === undefined ? ruleIndex : undefined
								}
								initialWhenIndex={
									outputDropIndex === undefined ? whenIndex : undefined
								}
								headerVisible={false}
								rules={rules}
								target="action"
								allowedTypes={[
									"enable",
									"disable",
								]}
								description={rulesDescription}
								onChangeFn={(next) =>
									form.setFieldValue("clock.rules", next as RuleSchema.Type[])
								}
							/>
						)}
					</form.Subscribe>
				</EditorFormCard>
			</EditorFormSection>
			{clock.durationMs === undefined ? null : (
				<>
					<EditorFormSection
						title={translator.textFn("Expiry output")}
						description={translator.textFn(
							"Resolved once when the item expires. Kill switch places what fits after returned materials; excess output is lost and logged.",
						)}
					>
						<EditorFormCard>
							<form.Subscribe selector={(state) => state.values.clock?.onExpire}>
								{(output) => (
									<OptionalOutputControl
										addLabel={translator.textFn("Enable")}
										emptyIcon={PackagePlus}
										emptyTitle={translator.textFn(
											"Item expiry output empty title",
										)}
										value={output}
										onChangeFn={(next) =>
											form.setFieldValue("clock.onExpire", next)
										}
									/>
								)}
							</form.Subscribe>
						</EditorFormCard>
					</EditorFormSection>
				</>
			)}
		</div>
	);
};

/** Authors an optional schedule independently of the item's manual production controls. */
export const ClockSection = () => {
	const { form, enableClockFn } = useFormSession();
	const translator = useTranslator();
	return (
		<form.Subscribe selector={(state) => state.values.clock}>
			{(clock) =>
				clock === undefined ? (
					<EditorCapabilityStatus
						icon={Clock}
						title={translator.textFn("No Clock configured")}
						summary={translator.textFn("Item clock empty title")}
						size="large"
						actionLabel={translator.textFn("Enable")}
						onEnableFn={enableClockFn}
					/>
				) : (
					<div
						className="grid gap-[var(--ak-viewport-gap)]"
						data-ui="EditorClockSection"
					>
						<ClockFields />
					</div>
				)
			}
		</form.Subscribe>
	);
};

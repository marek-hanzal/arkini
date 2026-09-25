import { Clock } from "lucide-react";
import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import type { RuleSchema } from "~/production-action/schema/RuleSchema";
import { useStore } from "@tanstack/react-form";
import { RulesControl } from "~/production-authoring/ui/RulesControl";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { SectionEnd } from "~/ui/ui/SectionEnd";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Mx } from "~/translation/ui/Mx";
import { ItemSectionDisableControl } from "~/item-authoring/ui/ItemSectionDisableControl";
/** Composes time and rule controls for the authored schedule. */
const ClockFields = () => {
	const translator = useTranslator();
	const { form, ruleIndex, whenIndex, outcomeIndex } = useFormSession();
	const clock = useStore(form.store, (state) => state.values.clock);
	const rulesDescription = <Mx label="Clock rules help" />;
	if (clock === undefined) return null;
	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorClockFields"
		>
			<EditorFormCard>
				<EditorFormSectionDivider
					title={translator.textFn("Clock")}
					action={<ItemSectionDisableControl capability="clock" />}
				/>
				<div className="grid grid-cols-2 items-start gap-4">
					<form.AppField name="clock.durationMs">
						{(field) => (
							<field.SecondsField
								label={translator.textFn("Lifetime (seconds)")}
								clearLabel={translator.textFn("Clear lifetime")}
								description={<Mx label="Clock lifetime help" />}
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
								description={<Mx label="Clock interval help" />}
								min={5}
								step={5}
								optional
							/>
						)}
					</form.AppField>
					<div className="flex items-start justify-between gap-4">
						<form.AppField name="clock.enable">
							{(field) => (
								<EditorChoiceControl
									description={<Mx label="Clock status help" />}
									label={translator.textFn("Status")}
									options={[
										{
											label: translator.textFn("Enabled"),
											value: "enabled",
										},
										{
											label: translator.textFn("Disabled"),
											value: "disabled",
										},
									]}
									required={false}
									value={field.state.value ? "enabled" : "disabled"}
									onChangeFn={(value) => field.handleChange(value === "enabled")}
								/>
							)}
						</form.AppField>
					</div>
				</div>
				<SectionEnd />
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
									outcomeIndex === undefined ? ruleIndex : undefined
								}
								initialWhenIndex={
									outcomeIndex === undefined ? whenIndex : undefined
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
					<div
						className="grid gap-[var(--ak-viewport-gap)]"
						data-ui="EditorClockSection"
					>
						<EditorCapabilityStatus
							icon={Clock}
							title={translator.textFn("No Clock configured")}
							summary={translator.textFn("Item clock empty title")}
							size="normal"
							actionLabel={translator.textFn("Enable")}
							onEnableFn={enableClockFn}
						/>
					</div>
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

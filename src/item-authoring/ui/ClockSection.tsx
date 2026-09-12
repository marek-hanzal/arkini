import { CircleCheck, CircleX, Clock, PackagePlus } from "lucide-react";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import type { RuleSchema } from "~/production-action/schema/RuleSchema";
import { useStore } from "@tanstack/react-form";
import { RulesControl } from "~/production-authoring/ui/RulesControl";
import { OptionalOutputControl } from "~/production-authoring/ui/OptionalOutputControl";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { useTranslator } from "~/translation/ui/useTranslator";
import { EditorCapabilityDisable } from "~/editor-control/ui/EditorCapabilityDisable";
/** Composes shared time, rule, and output controls for the authored schedule. */
const ClockFields = () => {
	const translator = useTranslator();
	const { form } = useFormSession();
	const clock = useStore(form.store, (state) => state.values.clock);
	if (clock === undefined) return null;
	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorClockFields"
		>
			<EditorFormCard>
				<div className="grid w-1/2 gap-4">
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
					<form.AppField name="clock.durationMs">
						{(field) => (
							<field.SecondsField
								label={translator.textFn("Lifetime (seconds)")}
								clearLabel={translator.textFn("Clear lifetime")}
								description={translator.textFn(
									"Leave empty to run indefinitely. Expiry closes admission and waits for production to settle.",
								)}
								min={5}
								step={5}
								optional
							/>
						)}
					</form.AppField>
					<div className="w-fit">
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
			</EditorFormCard>
			<EditorFormCard>
				<form.Subscribe selector={(state) => state.values.clock?.rules ?? []}>
					{(rules) => (
						<RulesControl
							rules={rules}
							target="action"
							allowedTypes={[
								"enable",
								"disable",
							]}
							description={translator.textFn(
								"These rules gate the clock's timer. Every Enable rule must pass and any matching Disable rule vetoes it. Accepted production uses its own line rules.",
							)}
							onChangeFn={(next) =>
								form.setFieldValue("clock.rules", next as RuleSchema.Type[])
							}
						/>
					)}
				</form.Subscribe>
			</EditorFormCard>
			{clock.durationMs === undefined ? null : (
				<>
					<EditorFormSectionDivider
						title={translator.textFn("Expiry output")}
						description={translator.textFn(
							"Emitted once after the finite lifetime ends and accepted production has settled.",
						)}
					/>
					<EditorFormCard>
						<form.Subscribe selector={(state) => state.values.clock?.onExpire}>
							{(output) => (
								<OptionalOutputControl
									addLabel={translator.textFn("Enable expiry output")}
									emptyDescription={translator.textFn(
										"Without an output, the clock disappears after expiry and production settlement.",
									)}
									emptyIcon={PackagePlus}
									emptyTitle={translator.textFn("Item expiry output empty title")}
									value={output}
									onChangeFn={(next) =>
										form.setFieldValue("clock.onExpire", next)
									}
								/>
							)}
						</form.Subscribe>
					</EditorFormCard>
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
					<EditorFormCard>
						<EditorCapabilityStatus
							icon={Clock}
							title={translator.textFn("Item clock empty title")}
							actionLabel={translator.textFn("Enable clock")}
							onEnableFn={enableClockFn}
						/>
					</EditorFormCard>
				) : (
					<div
						className="grid gap-[var(--ak-viewport-gap)]"
						data-ui="EditorClockSection"
					>
						<ClockFields />
						<EditorCapabilityDisable
							title={translator.textFn("Clock configured")}
							description={translator.textFn(
								"Disable removes timing, rules and expiry output from this item.",
							)}
							onDisableFn={() => form.setFieldValue("clock", undefined)}
						/>
					</div>
				)
			}
		</form.Subscribe>
	);
};

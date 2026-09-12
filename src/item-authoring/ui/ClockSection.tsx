import { CircleCheck, CircleX, Clock, PackagePlus, Trash2 } from "lucide-react";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import type { RuleSchema } from "~/production-action/schema/RuleSchema";
import { useStore } from "@tanstack/react-form";
import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";
import { RulesControl } from "~/production-authoring/ui/RulesControl";
import { OptionalOutputControl } from "~/production-authoring/ui/OptionalOutputControl";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Button } from "~/ui/ui/Button";
/** Composes shared time, rule, and output controls for the authored schedule. */
const ClockFields = () => {
	const translator = useTranslator();
	const { form } = useFormSession();
	const clock = useStore(form.store, (state) => state.values.clock);
	if (clock === undefined) return null;
	const once = clock.intervalMs === undefined;
	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorClockFields"
		>
			<EditorFormCard>
				<EditorFormSectionDivider
					title={translator.textFn("Clock")}
					description={translator.textFn(
						"Interval attempts the line marked Clock periodically. Once expires after its lifetime and emits the expiry output. Accepted production keeps its ordinary line rules.",
					)}
					variant="secondary"
				/>
				<EditorChoiceControl
					label={translator.textFn("Clock mode")}
					value={once ? "once" : "interval"}
					options={[
						{
							value: "interval",
							label: translator.textFn("Interval"),
						},
						{
							value: "once",
							label: translator.textFn("Once"),
						},
					]}
					onChangeFn={(mode) =>
						form.setFieldValue(
							"clock",
							mode === "once"
								? {
										...clock,
										intervalMs: undefined,
										durationMs: clock.durationMs ?? 300_000,
									}
								: {
										...clock,
										intervalMs: clock.intervalMs ?? 1000,
									},
						)
					}
				/>
				<div className="grid grid-cols-2 gap-4">
					{once ? null : (
						<form.AppField name="clock.intervalMs">
							{(field) => (
								<field.SecondsField
									label={translator.textFn("Interval (seconds)")}
									min={0.1}
								/>
							)}
						</form.AppField>
					)}
					<form.AppField name="clock.durationMs">
						{(field) => (
							<field.SecondsField
								label={translator.textFn("Lifetime (seconds)")}
								description={translator.textFn(
									once
										? "Once requires a lifetime. When it ends, accepted production settles before the expiry output is emitted."
										: "Leave empty to run indefinitely. Expiry closes admission and waits for production to settle.",
								)}
								min={0.1}
								optional={!once}
							/>
						)}
					</form.AppField>
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
							emptyTitle={translator.textFn("No expiry output")}
							value={output}
							onChangeFn={(next) => form.setFieldValue("clock.onExpire", next)}
						/>
					)}
				</form.Subscribe>
			</EditorFormCard>
		</div>
	);
};

/** Authors an optional schedule independently of the item's manual production controls. */
export const ClockSection = () => {
	const { canonicalItem, form } = useFormSession();
	const translator = useTranslator();
	if (canonicalItem.type !== "common") return null;
	return (
		<form.Subscribe selector={(state) => state.values.clock}>
			{(clock) =>
				clock === undefined ? (
					<EditorFormCard>
						<EditorCapabilityStatus
							icon={Clock}
							title={translator.textFn("Clock is disabled")}
							actionLabel={translator.textFn("Enable clock")}
							description={translator.textFn(
								"A clock can run at intervals or expire once. Enabling it removes the action and fixes this item to the board with a stack size of one.",
							)}
							onEnableFn={() => {
								form.setFieldValue("action", undefined);
								form.setFieldValue("scope", "board");
								form.setFieldValue("maxStackSize", 1);
								form.setFieldValue("clock", {
									intervalMs: 1000,
									enable: true,
									rules: [],
								});
							}}
						/>
					</EditorFormCard>
				) : (
					<div
						className="grid gap-[var(--ak-viewport-gap)]"
						data-ui="EditorClockSection"
					>
						<div className="flex justify-end">
							<Button
								title={translator.textFn("Disable clock")}
								onClick={() => form.setFieldValue("clock", undefined)}
							>
								<Trash2 className="size-4" />
							</Button>
						</div>
						<ClockFields />
					</div>
				)
			}
		</form.Subscribe>
	);
};

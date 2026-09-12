import { match } from "ts-pattern";
import { MapPinned } from "lucide-react";

import type { InputSchema as ActionInputSchema } from "~/production-action/schema/InputSchema";
import type { RuleSchema as ActionRuleSchema } from "~/production-action/schema/RuleSchema";
import { EditorCapabilityDisable } from "~/editor-control/ui/EditorCapabilityDisable";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { InputsControl } from "~/production-authoring/ui/InputsControl";
import { RulesControl } from "~/production-authoring/ui/RulesControl";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButton } from "~/ui/ui/LinkButton";

const RandomSpaceMinimum = 128;
const RandomSpaceMaximum = 1_024;

/** Authors the optional immediate action; production and action never coexist. */
export const ActionSection = () => {
	const translator = useTranslator();
	const { form, enableActionFn } = useFormSession();
	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorActionSection"
		>
			<form.Subscribe selector={(state) => state.values.action}>
				{(action) =>
					action === undefined ? (
						<EditorFormCard>
							<EditorCapabilityStatus
								actionLabel={translator.textFn("Enable action")}
								dataUi="EditorActionDisabled"
								description={translator.textFn(
									"An action activates immediately when the player uses this item. Enabling an action removes all production lines and the clock.",
								)}
								icon={MapPinned}
								onEnableFn={enableActionFn}
								title={translator.textFn("Action is disabled")}
							/>
						</EditorFormCard>
					) : (
						<>
							<EditorFormCard>
								<div className="flex items-end justify-between gap-4">
									<EditorChoiceControl
										label={translator.textFn("Action type")}
										value={action.type}
										options={[
											{
												value: "inventory",
												label: translator.textFn("Inventory"),
												description: translator.textFn(
													"Open the inventory after all requirements and rules pass.",
												),
											},
											{
												value: "space",
												label: translator.textFn("Space"),
												description: translator.textFn(
													"Enter the configured space after all requirements and rules pass.",
												),
											},
										]}
										onChangeFn={(type) =>
											form.setFieldValue(
												"action",
												type === "inventory"
													? {
															type,
															input: action.input,
															rules: action.rules,
														}
													: {
															type,
															space: 0,
															input: action.input,
															rules: action.rules,
														},
											)
										}
									/>
								</div>
							</EditorFormCard>
							<EditorFormSectionDivider
								title={
									action.type === "space"
										? translator.textFn("Space")
										: translator.textFn("Inventory")
								}
								description={
									action.type === "space"
										? translator.textFn(
												"Activating this item settles its requirements and unit costs, then enters the target space.",
											)
										: translator.textFn(
												"Open the inventory after all requirements and rules pass.",
											)
								}
							/>
							{match(action)
								.with(
									{
										type: "space",
									},
									() => (
										<EditorFormCard>
											<form.AppField name="action.space">
												{(field) => (
													<div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
														<field.NumberField
															description={translator.textFn(
																"The board space entered after successful activation. One-way navigation is allowed.",
															)}
															label={translator.textFn(
																"Target space",
															)}
															min={0}
														/>
														<LinkButton
															className="flex h-[var(--ak-control-min-height)] items-center whitespace-nowrap"
															onClick={() =>
																field.handleChange(
																	Math.floor(
																		Math.random() *
																			(RandomSpaceMaximum -
																				RandomSpaceMinimum +
																				1),
																	) + RandomSpaceMinimum,
																)
															}
														>
															{translator.textFn("Pick random space")}
														</LinkButton>
													</div>
												)}
											</form.AppField>
										</EditorFormCard>
									),
								)
								.with(
									{
										type: "inventory",
									},
									() => null,
								)
								.exhaustive()}
							<EditorFormCard>
								<RulesControl
									allowedTypes={[
										"enable",
										"disable",
									]}
									description={translator.textFn(
										"Every Enable rule must pass, and any matching Disable rule prevents activation.",
									)}
									rules={action.rules}
									target="action"
									onChangeFn={(rules) =>
										form.setFieldValue(
											"action.rules",
											rules as ActionRuleSchema.Type[],
										)
									}
								/>
							</EditorFormCard>
							<EditorFormCard>
								<InputsControl
									allowMaterials={false}
									emptyAllowed
									value={action.input}
									onChangeFn={(input) =>
										form.setFieldValue(
											"action.input",
											input.filter(
												(candidate): candidate is ActionInputSchema.Type =>
													candidate.type !== "materials",
											),
										)
									}
								/>
							</EditorFormCard>
							<EditorCapabilityDisable
								title={translator.textFn("Action configured")}
								description={translator.textFn(
									"Disable removes this action, its rules and input requirements. It does not restore removed production lines or Clock.",
								)}
								onDisableFn={() => form.setFieldValue("action", undefined)}
							/>
						</>
					)
				}
			</form.Subscribe>
		</div>
	);
};

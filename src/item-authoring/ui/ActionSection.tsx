import { match } from "ts-pattern";
import { MapPinned } from "lucide-react";

import type { InputSchema as ActionInputSchema } from "~/production-action/schema/InputSchema";
import type { RuleSchema as ActionRuleSchema } from "~/production-action/schema/RuleSchema";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormBranchEnd } from "~/editor-control/ui/EditorFormBranchEnd";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { InputsControl } from "~/production-authoring/ui/InputsControl";
import { RulesControl } from "~/production-authoring/ui/RulesControl";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Mx } from "~/translation/ui/Mx";

const RandomSpaceMinimum = 128;
const RandomSpaceMaximum = 1_024;

/** Authors the optional immediate action; production and action never coexist. */
export const ActionSection = () => {
	const translator = useTranslator();
	const { form, enableActionFn, ruleIndex, whenIndex, outputDropIndex } = useFormSession();
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
								actionLabel={translator.textFn("Enable")}
								dataUi="EditorActionDisabled"
								icon={MapPinned}
								onEnableFn={enableActionFn}
								title={translator.textFn("Item action empty title")}
							/>
						</EditorFormCard>
					) : (
						<>
							<EditorFormCard>
								<EditorFormSectionDivider
									required
									title={translator.textFn("Action type")}
									variant="secondary"
								/>
								<div className="flex items-end justify-between gap-4">
									<EditorChoiceControl
										label={translator.textFn("Action type")}
										labelVisible={false}
										value={action.type}
										options={[
											{
												value: "inventory",
												label: translator.textFn("Inventory"),
												description: (
													<Mx label="Inventory action type help" />
												),
											},
											{
												value: "space",
												label: translator.textFn("Space"),
												description: <Mx label="Space action type help" />,
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
								<EditorFormBranchEnd />
							</EditorFormCard>
							<EditorFormSection
								title={
									action.type === "space"
										? translator.textFn("Space")
										: translator.textFn("Inventory")
								}
								description={
									action.type === "space" ? (
										<Mx label="Space action help" />
									) : (
										<Mx label="Inventory action help" />
									)
								}
							>
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
																description={
																	<Mx label="Target space help" />
																}
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
																{translator.textFn(
																	"Pick random space",
																)}
															</LinkButton>
														</div>
													)}
												</form.AppField>
												<EditorFormBranchEnd />
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
										initialRuleIndex={
											outputDropIndex === undefined ? ruleIndex : undefined
										}
										initialWhenIndex={
											outputDropIndex === undefined ? whenIndex : undefined
										}
										allowedTypes={[
											"enable",
											"disable",
										]}
										description={<Mx label="Action rules help" />}
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
													(
														candidate,
													): candidate is ActionInputSchema.Type =>
														candidate.type !== "materials",
												),
											)
										}
									/>
								</EditorFormCard>
							</EditorFormSection>
						</>
					)
				}
			</form.Subscribe>
		</div>
	);
};

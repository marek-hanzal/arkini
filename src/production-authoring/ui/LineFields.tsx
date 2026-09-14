import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { readEditorFieldErrorFn } from "~/editor-control/fn/readEditorFieldErrorFn";
import { readEditorIdFromTitleFn } from "~/editor-control/fn/readEditorIdFromTitleFn";
import { useTranslator } from "~/translation/ui/useTranslator";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { withFieldGroupFn } from "~/authoring-form/ui/EditorForm";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { Mx } from "~/translation/ui/Mx";
import { InputsControl } from "~/production-authoring/ui/InputsControl";
import { OutputControl } from "~/production-authoring/ui/OutputControl";
import { RulesControl } from "~/production-authoring/ui/RulesControl";
import { EditorBooleanToggleGroup } from "~/editor-control/ui/EditorBooleanToggleGroup";

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
		const { ruleIndex, whenIndex, outputDropIndex } = useFormSession();
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
							<div className="grid min-w-0 grid-cols-2 items-start gap-3">
								<group.AppField name="title">
									{(field) => (
										<EditorTextControl
											label={translator.textFn("Line title")}
											name={field.name}
											value={field.state.value}
											error={readEditorFieldErrorFn(field.state.meta.errors)}
											onBlurFn={field.handleBlur}
											onChangeFn={(title) => {
												field.handleChange(title);
												group.setFieldValue(
													"id",
													readEditorIdFromTitleFn(title),
												);
											}}
										/>
									)}
								</group.AppField>
								<group.AppField name="id">
									{(field) => (
										<field.TextField label={translator.textFn("Line ID")} />
									)}
								</group.AppField>
							</div>
							<group.AppField name="runtimeMs">
								{(field) => (
									<field.SecondsField
										step={5}
										label={translator.textFn("Runtime (seconds)")}
										description={<Mx label="Production line runtime help" />}
									/>
								)}
							</group.AppField>
							<div className="flex min-w-0 flex-wrap items-end gap-3">
								<group.Subscribe
									selector={(state) => ({
										ahead: state.values.ahead === true,
										clock: state.values.clock === true,
										default: state.values.default,
										enable: state.values.enable,
										show: state.values.show,
									})}
								>
									{(markers) => (
										<EditorBooleanToggleGroup
											options={[
												{
													description: (
														<Mx label="Production line default help" />
													),
													label: translator.textFn("Default"),
													onChangeFn: (value) =>
														onMarkerChangeFn("default", value),
													selected: markers.default,
													value: "default",
												},
												{
													description: (
														<Mx label="Production line Clock help" />
													),
													label: translator.textFn("Clock"),
													onChangeFn: (value) =>
														onMarkerChangeFn("clock", value),
													selected: markers.clock,
													value: "clock",
												},
												{
													description: (
														<Mx label="Production line visibility help" />
													),
													label: translator.textFn("Visible"),
													onChangeFn: (value) =>
														group.setFieldValue("show", value),
													selected: markers.show,
													value: "visible",
												},
												{
													description: (
														<Mx label="Production line enabled help" />
													),
													label: translator.textFn("Enabled"),
													onChangeFn: (value) =>
														group.setFieldValue("enable", value),
													selected: markers.enable,
													value: "enabled",
												},
												{
													description: (
														<Mx label="Production line check ahead help" />
													),
													label: translator.textFn("Check ahead"),
													onChangeFn: (value) =>
														group.setFieldValue("ahead", value),
													selected: markers.ahead,
													value: "ahead",
												},
											]}
										/>
									)}
								</group.Subscribe>
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
								initialRuleIndex={
									outputDropIndex === undefined ? ruleIndex : undefined
								}
								initialWhenIndex={
									outputDropIndex === undefined ? whenIndex : undefined
								}
								rules={rules}
								target="line"
								description={<Mx label="Production line rules help" />}
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
				<EditorRootCard
					className="min-w-0 gap-[var(--ak-viewport-gap)]"
					dataUi="EditorFormCard"
				>
					<div>
						<EditorFormSectionDivider title={translator.textFn("Production")} />
					</div>
					<div className="min-w-0">
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
					<div className="min-w-0">
						<group.Subscribe selector={(state) => state.values.output}>
							{(output) => (
								<section className="grid min-w-0 content-start gap-3">
									<EditorFormSectionDivider
										description={<Mx label="Production output help" />}
										title={translator.textFn("Outputs")}
										variant="secondary"
									/>
									<OutputControl
										value={output}
										onChangeFn={(next) => group.setFieldValue("output", next)}
									/>
								</section>
							)}
						</group.Subscribe>
					</div>
				</EditorRootCard>
			</div>
		);
	},
});

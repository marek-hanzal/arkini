import { useTranslator } from "~/translation/ui/useTranslator";

import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";
import { OutputControl } from "~/production-authoring/ui/OutputControl";
import { SelectorControl } from "~/production-authoring/ui/SelectorControl";
import { EditorItemReferenceControl } from "~/authoring-form/ui/EditorItemAutocompleteField";
import { useFormValidationIssues } from "~/item-authoring/ui/useFormValidationIssues";
import { readEditorFormValidationErrorFn } from "~/editor-control/fn/readEditorFormValidationErrorFn";
import { Mx } from "~/translation/ui/Mx";

/** Edits the target, effects, replacement, and optional output of one merge definition. */
export const MergeField = ({
	merge,
	onChangeFn,
	sourceUnitsEnabled,
	targetUnitsEnabled,
}: {
	readonly merge: MergeSchema.Type;
	readonly onChangeFn: (merge: MergeSchema.Type) => void;
	readonly sourceUnitsEnabled: boolean;
	readonly targetUnitsEnabled: boolean;
}) => {
	const translator = useTranslator();
	const validationIssues = useFormValidationIssues(merge);
	const sourceError = readEditorFormValidationErrorFn(validationIssues, "action");
	const targetError = readEditorFormValidationErrorFn(validationIssues, "effect");
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormCard>
				<article className="grid grid-cols-2 items-start gap-[var(--ak-panel-padding)]">
					<EditorChoiceControl
						error={
							sourceError !== undefined &&
							merge.action === "spend" &&
							!sourceUnitsEnabled
								? translator.textFn(
										"Enable Units on this item before selecting Spend.",
									)
								: sourceError
						}
						label={translator.textFn("Source action")}
						value={merge.action}
						options={[
							{
								description: <Mx label="Merge source use help" />,
								label: translator.textFn("Use"),
								value: "use",
							},
							{
								description: <Mx label="Merge source consume help" />,
								label: translator.textFn("Consume"),
								value: "consume",
							},
							{
								description: <Mx label="Merge source spend help" />,
								disabled: !sourceUnitsEnabled,
								label: translator.textFn("Spend"),
								value: "spend",
							},
						]}
						onChangeFn={(action) =>
							onChangeFn({
								...merge,
								action,
							})
						}
					/>
					<SelectorControl
						error={readEditorFormValidationErrorFn(validationIssues, "target")}
						value={merge.target}
						onChangeFn={(target) =>
							onChangeFn({
								...merge,
								target,
							})
						}
					/>
					<EditorChoiceControl
						error={
							targetError !== undefined &&
							merge.effect === "spend" &&
							!targetUnitsEnabled
								? translator.textFn(
										"Selected target must have Units enabled before choosing Spend.",
									)
								: targetError
						}
						label={translator.textFn("Target effect")}
						value={merge.effect}
						options={[
							{
								description: <Mx label="Merge target keep help" />,
								label: translator.textFn("Keep"),
								value: "keep",
							},
							{
								description: <Mx label="Merge target remove help" />,
								label: translator.textFn("Remove"),
								value: "remove",
							},
							{
								description: <Mx label="Merge target replace help" />,
								label: translator.textFn("Replace"),
								value: "replace",
							},
							{
								description: <Mx label="Merge target spend help" />,
								disabled: !targetUnitsEnabled,
								label: translator.textFn("Spend"),
								value: "spend",
							},
						]}
						onChangeFn={(effect) =>
							onChangeFn(
								effect === "replace"
									? {
											...merge,
											effect,
											result: merge.effect === "replace" ? merge.result : "",
										}
									: {
											action: merge.action,
											effect,
											output: merge.output,
											target: merge.target,
										},
							)
						}
					/>
					{merge.effect !== "replace" ? null : (
						<EditorItemReferenceControl
							error={readEditorFormValidationErrorFn(validationIssues, "result")}
							label={translator.textFn("Replacement item")}
							value={merge.result}
							onChangeFn={(result) =>
								onChangeFn({
									...merge,
									result,
								})
							}
						/>
					)}
				</article>
			</EditorFormCard>
			<EditorFormSection
				description={<Mx label="Merge output help" />}
				title={translator.textFn("Merge output")}
			>
				<EditorFormCard>
					<OutputControl
						value={merge.output}
						onChangeFn={(output) =>
							onChangeFn({
								...merge,
								output,
							})
						}
					/>
				</EditorFormCard>
			</EditorFormSection>
		</div>
	);
};

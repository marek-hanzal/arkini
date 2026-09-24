import { SpaceDestinationControl } from "~/authoring-form/ui/SpaceDestinationControl";
import { MousePointer2, Flame, Coins, DoorOpen, ShieldCheck, Trash2, Replace } from "lucide-react";
import { useTranslator } from "~/translation/ui/useTranslator";

import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { SectionEnd } from "~/ui/ui/SectionEnd";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";
import { OutcomeControl } from "~/production-authoring/ui/OutcomeControl";
import { SelectorControl } from "~/production-authoring/ui/SelectorControl";
import { EditorItemReferenceControl } from "~/authoring-form/ui/EditorItemAutocompleteField";
import { useFormValidationIssues } from "~/item-authoring/ui/useFormValidationIssues";
import { readEditorFormValidationErrorFn } from "~/editor-control/fn/readEditorFormValidationErrorFn";
import { Mx } from "~/translation/ui/Mx";

/** Edits the target, effects, replacement, and optional outcome of one merge definition. */
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
								icon: <MousePointer2 className="size-4" />,
								value: "use",
							},
							{
								description: <Mx label="Merge source consume help" />,
								label: translator.textFn("Consume"),
								icon: <Flame className="size-4" />,
								value: "consume",
							},
							{
								description: <Mx label="Merge source spend help" />,
								disabled: !sourceUnitsEnabled,
								label: translator.textFn("Spend"),
								icon: <Coins className="size-4" />,
								value: "spend",
							},
							{
								description: <Mx label="Merge source space help" />,
								label: translator.textFn("Space"),
								icon: <DoorOpen className="size-4" />,
								value: "space",
							},
						]}
						onChangeFn={(action) => {
							if (action === merge.action) return;
							const effect =
								merge.effect === "replace"
									? {
											effect: merge.effect,
											result: merge.result,
										}
									: {
											effect: merge.effect,
										};
							onChangeFn(
								action === "space"
									? {
											...effect,
											action,
											space: 0,
											outcome: merge.outcome,
										}
									: {
											...effect,
											action,
											target:
												merge.action === "space"
													? {
															type: "item",
															itemUid: "",
														}
													: merge.target,
											outcome: merge.outcome,
										},
							);
						}}
					/>
					{merge.action === "space" ? (
						<SpaceDestinationControl
							error={readEditorFormValidationErrorFn(validationIssues, "space")}
							description={<Mx label="Previous Space transport help" />}
							value={merge.space}
							onChangeFn={(space) =>
								onChangeFn({
									...merge,
									space,
								})
							}
						/>
					) : (
						<SelectorControl
							description={<Mx label="Merge with help" />}
							error={readEditorFormValidationErrorFn(validationIssues, "target")}
							label={translator.textFn("Merge with")}
							value={merge.target}
							onChangeFn={(target) =>
								onChangeFn({
									...merge,
									target,
								})
							}
						/>
					)}
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
								icon: <ShieldCheck className="size-4" />,
								value: "keep",
							},
							{
								description: <Mx label="Merge target remove help" />,
								label: translator.textFn("Remove"),
								icon: <Trash2 className="size-4" />,
								value: "remove",
							},
							{
								description: <Mx label="Merge target replace help" />,
								label: translator.textFn("Replace"),
								icon: <Replace className="size-4" />,
								value: "replace",
							},
							{
								description: <Mx label="Merge target spend help" />,
								disabled: !targetUnitsEnabled,
								label: translator.textFn("Spend"),
								icon: <Coins className="size-4" />,
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
											...(merge.action === "space"
												? {
														action: merge.action,
														space: merge.space,
													}
												: {
														action: merge.action,
														target: merge.target,
													}),
											effect,
											outcome: merge.outcome,
										},
							)
						}
					/>
					{merge.effect !== "replace" ? null : (
						<EditorItemReferenceControl
							description={<Mx label="Replace by help" />}
							error={readEditorFormValidationErrorFn(validationIssues, "result")}
							label={translator.textFn("Replace by")}
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
				<SectionEnd />
			</EditorFormCard>
			<EditorFormSection
				description={<Mx label="Merge outcome help" />}
				title={translator.textFn("Merge outcome")}
			>
				<EditorFormCard>
					<OutcomeControl
						value={merge.outcome}
						onChangeFn={(outcome) =>
							onChangeFn({
								...merge,
								outcome,
							})
						}
					/>
				</EditorFormCard>
			</EditorFormSection>
		</div>
	);
};

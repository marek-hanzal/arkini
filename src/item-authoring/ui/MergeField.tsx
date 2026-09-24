import { SpaceDestinationControl } from "~/authoring-form/ui/SpaceDestinationControl";
import {
	MousePointer2,
	Flame,
	Coins,
	DoorOpen,
	History,
	Sparkles,
	ShieldCheck,
	Trash2,
	Replace,
} from "lucide-react";
import { useTranslator } from "~/translation/ui/useTranslator";

import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import type { SpaceDestinationSchema } from "~/space/schema/SpaceDestinationSchema";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
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
	const project = useEditorProject();
	const validationIssues = useFormValidationIssues(merge);
	const sourceError = readEditorFormValidationErrorFn(validationIssues, "action");
	const targetError = readEditorFormValidationErrorFn(validationIssues, "effect");
	const spaceActionLabel =
		merge.action !== "space" || typeof merge.space === "number"
			? translator.textFn("Space")
			: merge.space === "previous"
				? translator.textFn("Previous Space")
				: translator.textFn("Generated Space");
	const selectSpaceFn = (space: SpaceDestinationSchema.Type) => {
		if (merge.action === "space" && merge.space === space) return;
		const effect =
			merge.effect === "replace"
				? {
						effect: merge.effect,
						result: merge.result,
					}
				: {
						effect: merge.effect,
					};
		onChangeFn({
			...effect,
			action: "space",
			space,
			outcome: merge.outcome,
		});
	};
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
								label: spaceActionLabel,
								icon: <DoorOpen className="size-4" />,
								menuOptions: [
									{
										id: "exact",
										label: translator.textFn("Space"),
										description: translator.textFn(
											"Move the dropped item to an exact space number.",
										),
										icon: <DoorOpen className="size-5" />,
										onSelectFn: () =>
											selectSpaceFn(
												merge.action === "space" &&
													typeof merge.space === "number"
													? merge.space
													: 0,
											),
									},
									{
										id: "previous",
										label: translator.textFn("Previous Space"),
										description: translator.textFn(
											"Move the dropped item to the last space left. Without history, the merge is rejected.",
										),
										icon: <History className="size-5" />,
										onSelectFn: () => selectSpaceFn("previous"),
									},
									{
										id: "generated",
										label: translator.textFn("Generated Space"),
										description: translator.textFn(
											"Move the dropped item into the receiver's private room.",
										),
										icon: <Sparkles className="size-5" />,
										onSelectFn: () =>
											selectSpaceFn(
												merge.action === "space" &&
													typeof merge.space === "object"
													? merge.space
													: {
															type: "generated",
															templateUid:
																project.config.templates?.[0]
																	?.uid ?? "",
														},
											),
									},
								],
								value: "space",
							},
						]}
						onChangeFn={(action) => {
							if (action === merge.action) return;
							if (action === "space") return;
							const effect =
								merge.effect === "replace"
									? {
											effect: merge.effect,
											result: merge.result,
										}
									: {
											effect: merge.effect,
										};
							onChangeFn({
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
							});
						}}
					/>
					{merge.action === "space" && merge.space !== "previous" ? (
						<SpaceDestinationControl
							kindEditable={false}
							error={readEditorFormValidationErrorFn(validationIssues, "space")}
							value={merge.space}
							onChangeFn={(space) =>
								onChangeFn({
									...merge,
									space,
								})
							}
						/>
					) : merge.action === "space" ? (
						<div />
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

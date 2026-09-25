import { createId } from "@paralleldrive/cuid2";
import { useStore } from "@tanstack/react-form";
import { Clock } from "lucide-react";
import { createLineFn } from "~/production-authoring/fn/createLineFn";
import { duplicateLineFn } from "~/production-authoring/fn/duplicateLineFn";
import { setLineMarkerFn } from "~/production-authoring/fn/setLineMarkerFn";
import { ProductionLineOption } from "~/production-authoring/ui/ProductionLineOption";
import { LineFields } from "~/production-authoring/ui/LineFields";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { readCapabilityRelatedTermsFn } from "~/item-authoring/fn/readCapabilityRelatedTermsFn";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { useFormValidationFocusIndex } from "~/item-authoring/ui/useFormValidationIssues";
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";

/** One canonical line collection, projected into manual, interval, and item termination authoring. */
export const ProductionLinesSection = ({
	kind,
}: {
	readonly kind: "manual" | "clock" | "termination";
}) => {
	const { form, project, productionLineUid } = useFormSession();
	const translator = useTranslator();
	const allLines = useStore(form.store, (state) => state.values.lines) ?? [];
	const invalidLineIndex = useFormValidationFocusIndex(allLines);
	const indices = allLines.flatMap((line, index) =>
		(
			kind === "manual"
				? line.trigger === LineTriggerEnumSchema.enum.manual
				: kind === "clock"
					? line.trigger === LineTriggerEnumSchema.enum["clock-interval"]
					: line.trigger === LineTriggerEnumSchema.enum["item-termination"]
		)
			? [
					index,
				]
			: [],
	);
	const lines = indices.map((index) => allLines[index]);
	const title = translator.textFn(
		kind === "termination"
			? "Termination lines"
			: kind === "manual"
				? "Product lines"
				: "Production",
	);
	const addLineFn = (trigger: LineSchema.Type["trigger"] = LineTriggerEnumSchema.enum.manual) => {
		const currentLines = form.state.values.lines ?? [];
		const line = createLineFn(currentLines, "", "", createId());
		form.setFieldValue("lines", [
			...currentLines,
			{
				...line,
				trigger,
				default:
					trigger === LineTriggerEnumSchema.enum.manual &&
					!currentLines.some((existing) => existing.default),
			},
		]);
	};
	const addOptions =
		kind === "clock"
			? [
					{
						id: LineTriggerEnumSchema.enum["clock-interval"],
						label: translator.textFn("Clock - Interval"),
						description: translator.textFn(
							"Selects this line by weight at each Clock interval.",
						),
						icon: <Clock className="size-5" />,
						onSelectFn: () => addLineFn(LineTriggerEnumSchema.enum["clock-interval"]),
					},
				]
			: undefined;
	return (
		<EditorFormSection
			description={
				<Mx
					label={
						kind === "clock"
							? "Clock production lines help"
							: kind === "termination"
								? "Termination lines help"
								: "Product lines help"
					}
				/>
			}
			title={title}
		>
			<form.AppField
				name="lines"
				mode="array"
			>
				{(linesField) => (
					<EditorCollectionSelector
						dataUi={
							kind === "clock"
								? "EditorClockLinesCollection"
								: kind === "termination"
									? "EditorTerminationLinesCollection"
									: "EditorProductionLinesCollection"
						}
						count={lines.length}
						itemLabelFn={(index) =>
							lines[index].title ||
							`${translator.textFn("Production line")} ${index + 1}`
						}
						itemSearchTermsFn={(index) => [
							lines[index].uid,
							lines[index].description ?? "",
						]}
						itemRelatedSearchTermsFn={(index) =>
							readCapabilityRelatedTermsFn(lines[index], project.config.items)
						}
						renderItemContentFn={(index, label) => (
							<ProductionLineOption
								items={project.config.items}
								line={lines[index]}
								label={label}
							/>
						)}
						initialSelectedIndex={Math.max(
							0,
							lines.findIndex((line) => line.uid === productionLineUid),
						)}
						selectedIndex={
							invalidLineIndex === undefined || !indices.includes(invalidLineIndex)
								? undefined
								: indices.indexOf(invalidLineIndex)
						}
						label={title}
						navigationCard
						addOptions={addOptions}
						onAddFn={
							kind === "manual"
								? () => addLineFn()
								: kind === "termination"
									? () =>
											addLineFn(
												LineTriggerEnumSchema.enum["item-termination"],
											)
									: undefined
						}
						onDuplicateFn={(index) => {
							const currentLines = form.state.values.lines ?? [];
							const absoluteIndex = indices[index];
							const duplicate = duplicateLineFn(
								currentLines[absoluteIndex],
								createId(),
							);
							form.setFieldValue("lines", [
								...currentLines.slice(0, absoluteIndex + 1),
								duplicate,
								...currentLines.slice(absoluteIndex + 1),
							]);
						}}
						onRemoveFn={(index) => linesField.removeValue(indices[index])}
					>
						{(index) => (
							<LineFields
								form={form}
								fields={`lines[${indices[index]}]`}
								label={null}
								onMarkerChangeFn={(value) =>
									form.setFieldValue(
										"lines",
										setLineMarkerFn(
											form.state.values.lines ?? [],
											indices[index],
											value,
										),
									)
								}
							/>
						)}
					</EditorCollectionSelector>
				)}
			</form.AppField>
		</EditorFormSection>
	);
};

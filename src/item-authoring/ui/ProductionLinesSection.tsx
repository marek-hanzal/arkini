import { createId } from "@paralleldrive/cuid2";
import { useStore } from "@tanstack/react-form";
import { Clock, Hourglass } from "lucide-react";
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

/** One canonical line collection, projected into manual or automatic authoring. */
export const ProductionLinesSection = ({ kind }: { readonly kind: "manual" | "automation" }) => {
	const { form, project, productionLineUid } = useFormSession();
	const translator = useTranslator();
	const allLines = useStore(form.store, (state) => state.values.lines) ?? [];
	const hasClockInterval = useStore(
		form.store,
		(state) => state.values.clock?.intervalMs !== undefined,
	);
	const hasItemEndingSignal = useStore(
		form.store,
		(state) => state.values.units !== undefined || state.values.clock?.durationMs !== undefined,
	);
	const invalidLineIndex = useFormValidationFocusIndex(allLines);
	const indices = allLines.flatMap((line, index) =>
		(
			kind === "manual"
				? line.trigger === LineTriggerEnumSchema.enum.manual
				: line.trigger !== LineTriggerEnumSchema.enum.manual
		)
			? [
					index,
				]
			: [],
	);
	const lines = indices.map((index) => allLines[index]);
	const title = translator.textFn(kind === "manual" ? "Product lines" : "Automation lines");
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
		kind === "automation"
			? [
					{
						id: LineTriggerEnumSchema.enum["clock-interval"],
						label: translator.textFn("Clock - Interval"),
						description: translator.textFn(
							hasClockInterval
								? "Selects this line by weight at each Clock interval."
								: "Set a Clock interval first.",
						),
						disabled: !hasClockInterval,
						icon: <Clock className="size-5" />,
						onSelectFn: () => addLineFn(LineTriggerEnumSchema.enum["clock-interval"]),
					},
					...(hasItemEndingSignal
						? [
								{
									id: LineTriggerEnumSchema.enum["item-termination"],
									label: translator.textFn("Item ending"),
									description: translator.textFn(
										"Selects this line by weight when lifetime or units run out.",
									),
									icon: <Hourglass className="size-5" />,
									onSelectFn: () =>
										addLineFn(LineTriggerEnumSchema.enum["item-termination"]),
								},
							]
						: []),
				]
			: undefined;
	return (
		<EditorFormSection
			description={
				<Mx
					label={kind === "automation" ? "Automation lines help" : "Product lines help"}
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
							kind === "automation"
								? "EditorAutomationLinesCollection"
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
						onAddFn={kind === "manual" ? () => addLineFn() : undefined}
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

import { createId } from "@paralleldrive/cuid2";
import { useStore } from "@tanstack/react-form";
import { Clock, Hourglass } from "lucide-react";
import { createLineFn } from "~/production-authoring/fn/createLineFn";
import { duplicateLineFn } from "~/production-authoring/fn/duplicateLineFn";
import { setLineMarkerFn } from "~/production-authoring/fn/setLineMarkerFn";
import { ProductionLineOption } from "~/production-authoring/ui/ProductionLineOption";
import { LineFields } from "~/production-authoring/ui/LineFields";
import { LineClockModeEnumSchema } from "~/production-line/schema/LineClockModeEnumSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { readCapabilityRelatedTermsFn } from "~/item-authoring/fn/readCapabilityRelatedTermsFn";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { useFormValidationFocusIndex } from "~/item-authoring/ui/useFormValidationIssues";
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";

/** One canonical line collection, projected into manual and Clock authoring tabs. */
export const ProductionLinesSection = ({ kind }: { readonly kind: "manual" | "clock" }) => {
	const { form, project, productionLineUid } = useFormSession();
	const translator = useTranslator();
	const allLines = useStore(form.store, (state) => state.values.lines) ?? [];
	const invalidLineIndex = useFormValidationFocusIndex(allLines);
	const indices = allLines.flatMap((line, index) =>
		(line.clock !== undefined) === (kind === "clock")
			? [
					index,
				]
			: [],
	);
	const lines = indices.map((index) => allLines[index]);
	const title = translator.textFn(kind === "clock" ? "Production" : "Product lines");
	const addLineFn = (clock?: LineSchema.Type["clock"]) => {
		const currentLines = form.state.values.lines ?? [];
		const line = createLineFn(currentLines, "", "", createId());
		form.setFieldValue("lines", [
			...currentLines,
			{
				...line,
				...(clock === undefined
					? {}
					: {
							clock,
						}),
				default: clock === undefined && !currentLines.some((existing) => existing.default),
			},
		]);
	};
	const addOptions =
		kind === "clock"
			? [
					{
						id: LineClockModeEnumSchema.enum["clock-interval"],
						label: translator.textFn("Clock - Interval"),
						description: translator.textFn(
							"Selects this line by weight at each Clock interval.",
						),
						icon: <Clock className="size-5" />,
						onSelectFn: () => addLineFn(LineClockModeEnumSchema.enum["clock-interval"]),
					},
					{
						id: LineClockModeEnumSchema.enum["clock-lifetime"],
						label: translator.textFn("Clock - Expiry"),
						description: translator.textFn(
							"At lifetime expiry, selects this line by weight. On a Board it runs as a Job; inside another item or Job, its output settles immediately without inputs or runtime.",
						),
						icon: <Hourglass className="size-5" />,
						onSelectFn: () => addLineFn(LineClockModeEnumSchema.enum["clock-lifetime"]),
					},
				]
			: undefined;
	return (
		<EditorFormSection
			description={
				<Mx
					label={kind === "clock" ? "Clock production lines help" : "Product lines help"}
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

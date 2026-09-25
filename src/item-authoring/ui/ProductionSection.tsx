import { createId } from "@paralleldrive/cuid2";
import { ProductionLineOption } from "~/production-authoring/ui/ProductionLineOption";
import { readCapabilityRelatedTermsFn } from "~/item-authoring/fn/readCapabilityRelatedTermsFn";
import { createLineFn } from "~/production-authoring/fn/createLineFn";
import { setLineClockFn, setLineMarkerFn } from "~/production-authoring/fn/setLineMarkerFn";
import { useTranslator } from "~/translation/ui/useTranslator";

import { useFormSession } from "~/item-authoring/ui/FormContext";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { LineFields } from "~/production-authoring/ui/LineFields";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { withFieldGroupFn } from "~/authoring-form/ui/EditorForm";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { Mx } from "~/translation/ui/Mx";
import { useStore } from "@tanstack/react-form";
import { useFormValidationFocusIndex } from "~/item-authoring/ui/useFormValidationIssues";
import { duplicateLineFn } from "~/production-authoring/fn/duplicateLineFn";

interface ProductionFieldValues {
	readonly maxQueueSize?: number;
	readonly lines: Array<LineSchema.Type> | undefined;
}

const defaultProductionFieldValues: ProductionFieldValues = {
	maxQueueSize: 1,
	lines: undefined,
};

const ProductionFields = withFieldGroupFn({
	defaultValues: defaultProductionFieldValues,
	props: {
		invalidLineIndex: undefined as number | undefined,
		selectedLineUid: undefined as string | undefined,
	},
	render: ({ group, invalidLineIndex, selectedLineUid }) => {
		const translator = useTranslator();
		const { form, project } = useFormSession();
		return (
			<div className="grid gap-[var(--ak-viewport-gap)]">
				<EditorFormSection
					description={<Mx label="Production queue capacity help" />}
					required
					title={translator.textFn("Queue capacity")}
				>
					<EditorFormCard>
						<group.AppField name="maxQueueSize">
							{(field) => (
								<field.NumberField
									label={translator.textFn("Queue capacity")}
									labelVisible={false}
									min={1}
								/>
							)}
						</group.AppField>
					</EditorFormCard>
				</EditorFormSection>
				<EditorFormSection
					description={<Mx label="Product lines help" />}
					title={translator.textFn("Product lines")}
				>
					<group.AppField
						name="lines"
						mode="array"
					>
						{(linesField) => {
							const lines = linesField.state.value ?? [];
							const addLineFn = () => {
								const currentLines = form.state.values.lines ?? [];
								const line = createLineFn(currentLines, "", "", createId());
								form.setFieldValue("lines", [
									...currentLines,
									line,
								]);
							};

							return (
								<>
									<EditorCollectionSelector
										dataUi="EditorProductionLinesCollection"
										count={lines.length}
										itemLabelFn={(index) => {
											const line = lines[index];
											return line.title.length === 0
												? `${translator.textFn("Production line")} ${index + 1}`
												: line.title;
										}}
										renderItemContentFn={(index, label) => (
											<ProductionLineOption
												items={project.config.items}
												line={lines[index]}
												label={label}
											/>
										)}
										itemSearchTermsFn={(index) => [
											lines[index].uid,
											lines[index].description,
										]}
										itemRelatedSearchTermsFn={(index) =>
											readCapabilityRelatedTermsFn(
												lines[index],
												project.config.items,
											)
										}
										initialSelectedIndex={Math.max(
											0,
											lines.findIndex((line) => line.uid === selectedLineUid),
										)}
										selectedIndex={invalidLineIndex}
										label={translator.textFn("Product lines")}
										navigationCard
										onAddFn={addLineFn}
										onDuplicateFn={(index) => {
											const currentLines = form.state.values.lines ?? [];
											const duplicate = duplicateLineFn(
												currentLines[index],
												createId(),
											);
											form.setFieldValue("lines", [
												...currentLines.slice(0, index + 1),
												duplicate,
												...currentLines.slice(index + 1),
											]);
										}}
										onRemoveFn={(index) => linesField.removeValue(index)}
									>
										{(index) => (
											<LineFields
												form={group}
												fields={`lines[${index}]`}
												label={null}
												onMarkerChangeFn={(value) =>
													form.setFieldValue(
														"lines",
														setLineMarkerFn(
															form.state.values.lines ?? [],
															index,
															value,
														),
													)
												}
												onClockChangeFn={(clock) =>
													form.setFieldValue(
														"lines",
														setLineClockFn(
															form.state.values.lines ?? [],
															index,
															clock,
														),
													)
												}
											/>
										)}
									</EditorCollectionSelector>
								</>
							);
						}}
					</group.AppField>
				</EditorFormSection>
			</div>
		);
	},
});

export const ProductionSection = () => {
	const { form, productionLineUid } = useFormSession();
	const lines = useStore(form.store, (state) => state.values.lines);
	const invalidLineIndex = useFormValidationFocusIndex(lines);
	return (
		<ProductionFields
			form={form}
			fields={{
				maxQueueSize: "maxQueueSize",
				lines: "lines",
			}}
			invalidLineIndex={invalidLineIndex}
			selectedLineUid={productionLineUid}
		/>
	);
};

import { ProductionLineOption } from "~/production-authoring/ui/ProductionLineOption";
import { readCapabilityRelatedTermsFn } from "~/item-authoring/fn/readCapabilityRelatedTermsFn";
import { createLineFn } from "~/production-authoring/fn/createLineFn";
import { setLineMarkerFn } from "~/production-authoring/fn/setLineMarkerFn";
import { useTranslator } from "~/translation/ui/useTranslator";

import { useFormSession } from "~/item-authoring/ui/FormContext";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { LineFields } from "~/production-authoring/ui/LineFields";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { withFieldGroupFn } from "~/authoring-form/ui/EditorForm";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { Mx } from "~/translation/ui/Mx";

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
		selectedLineId: undefined as string | undefined,
	},
	render: ({ group, invalidLineIndex, selectedLineId }) => {
		const translator = useTranslator();
		const { form, project } = useFormSession();
		return (
			<div className="grid gap-[var(--ak-viewport-gap)]">
				<EditorFormSection
					description={<Mx label="Product lines help" />}
					title={translator.textFn("Product lines")}
				>
					<EditorFormCard>
						<group.AppField name="maxQueueSize">
							{(field) => (
								<field.NumberField
									label={translator.textFn("Queue capacity")}
									description={<Mx label="Production queue capacity help" />}
									min={1}
								/>
							)}
						</group.AppField>
					</EditorFormCard>
					<group.AppField
						name="lines"
						mode="array"
					>
						{(linesField) => {
							const lines = linesField.state.value ?? [];
							const addLineFn = () => {
								const currentLines = form.state.values.lines ?? [];
								if (currentLines.length === 0)
									form.setFieldValue("action", undefined);
								const line = createLineFn(
									currentLines,
									translator.textFn("New production line"),
									translator.textFn(
										"Describe what this line consumes and produces.",
									),
								);
								form.setFieldValue("lines", [
									...currentLines,
									line,
								]);
							};

							return (
								<>
									<EditorCollectionSelector
										addLabel={translator.textFn("Add line")}
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
											lines[index].id,
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
											lines.findIndex((line) => line.id === selectedLineId),
										)}
										selectedIndex={invalidLineIndex}
										label={translator.textFn("Product lines")}
										navigationCard
										onAddFn={addLineFn}
										onRemoveFn={(index) => linesField.removeValue(index)}
										removeLabel={translator.textFn("Remove line")}
									>
										{(index) => (
											<LineFields
												form={group}
												fields={`lines[${index}]`}
												label={null}
												onMarkerChangeFn={(marker, value) =>
													form.setFieldValue(
														"lines",
														setLineMarkerFn(
															form.state.values.lines ?? [],
															index,
															marker,
															value,
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
	const { form, productionLineId, validationIssues } = useFormSession();
	const invalidLineIndex = validationIssues.find(
		(issue) => issue.path[0] === "lines" && typeof issue.path[1] === "number",
	)?.path[1] as number | undefined;
	return (
		<ProductionFields
			form={form}
			fields={{
				maxQueueSize: "maxQueueSize",
				lines: "lines",
			}}
			invalidLineIndex={invalidLineIndex}
			selectedLineId={productionLineId}
		/>
	);
};

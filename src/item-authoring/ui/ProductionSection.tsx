import { createLineFn } from "~/production-authoring/fn/createLineFn";
import { setLineMarkerFn } from "~/production-authoring/fn/setLineMarkerFn";
import { useTranslator } from "~/translation/ui/useTranslator";

import { useFormSession } from "~/item-authoring/ui/FormContext";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { LineFields } from "~/production-authoring/ui/LineFields";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { withFieldGroupFn } from "~/authoring-form/ui/EditorForm";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";

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
		const { form } = useFormSession();
		return (
			<div className="grid gap-[var(--ak-viewport-gap)]">
				<EditorFormCard>
					<group.AppField name="maxQueueSize">
						{(field) => (
							<field.NumberField
								label={translator.textFn("Queue capacity")}
								description={translator.textFn(
									"Maximum accepted work count across this item’s production lines: one active job plus queued requests.",
								)}
								min={1}
							/>
						)}
					</group.AppField>
				</EditorFormCard>
				<EditorFormSectionDivider
					description={translator.textFn(
						"Add lines to enable production. Adding a line removes the configured action. Each line has its own inputs, output, runtime and rules.",
					)}
					title={translator.textFn("Product lines")}
				/>
				<group.AppField
					name="lines"
					mode="array"
				>
					{(linesField) => {
						const lines = linesField.state.value ?? [];
						const addLineFn = () => {
							const currentLines = form.state.values.lines ?? [];
							if (currentLines.length === 0) form.setFieldValue("action", undefined);
							const line = createLineFn(
								form.state.values.id,
								currentLines,
								translator.textFn("New production line"),
								translator.textFn("Describe what this line consumes and produces."),
							);
							form.setFieldValue("lines", [
								...currentLines,
								line,
							]);
						};

						return (
							<EditorCollectionSelector
								addLabel={translator.textFn("Add line")}
								count={lines.length}
								itemLabelFn={(index) => {
									const line = lines[index];
									return line.title.length === 0
										? `${translator.textFn("Production line")} ${index + 1}`
										: line.title;
								}}
								itemSearchTermsFn={(index) => [
									lines[index].id,
								]}
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
						);
					}}
				</group.AppField>
			</div>
		);
	},
});

export const ProductionSection = () => {
	const translator = useTranslator();
	const { form, productionLineId, validationIssues } = useFormSession();
	const invalidLineIndex = validationIssues.find(
		(issue) => issue.path[0] === "lines" && typeof issue.path[1] === "number",
	)?.path[1] as number | undefined;
	const content = (
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
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormSectionDivider
				description={translator.textFn(
					"Defines this item's production lines, inputs, outputs, runtime and rules.",
				)}
				title={translator.textFn("Production")}
			/>
			{content}
		</div>
	);
};

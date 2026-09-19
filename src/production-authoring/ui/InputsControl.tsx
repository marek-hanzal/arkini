import { useTranslator } from "~/translation/ui/useTranslator";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { EditorCollectionOption } from "~/editor-control/ui/EditorCollectionOption";
import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { InputControl } from "~/production-authoring/ui/InputControl";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { useEditorItemOptionLabel } from "~/authoring-form/ui/useEditorItemSearchOptions";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { useStore } from "@tanstack/react-form";
import {
	useFormValidationFocusIndex,
	useFormValidationIssues,
} from "~/item-authoring/ui/useFormValidationIssues";
import { readEditorFormValidationIssuesFn } from "~/editor-control/fn/readEditorFormValidationIssuesFn";
import { readRequiredEditorCollectionErrorFn } from "~/editor-control/fn/readRequiredEditorCollectionErrorFn";
import { Mx } from "~/translation/ui/Mx";
import { BoardDistancePresentation } from "~/item-query/ui/QueryPresentation";

interface InputsControlProps {
	readonly allowMaterials?: boolean;
	readonly emptyAllowed?: boolean;
	readonly onChangeFn: (inputs: LineInputSchema.Type[]) => void;
	readonly value: ReadonlyArray<LineInputSchema.Type>;
}

/** Assembles immediate input requirements, optionally including Line-owned materials. */
export const InputsControl = ({
	allowMaterials = true,
	emptyAllowed = false,
	onChangeFn,
	value,
}: InputsControlProps) => {
	const translator = useTranslator();
	const project = useEditorProject();
	const readItemLabelFn = useEditorItemOptionLabel();
	const { form, itemId, inputIndex } = useFormSession();
	const selfUnitsEnabled = useStore(form.store, (state) => state.values.units !== undefined);
	const validationIssues = useFormValidationIssues(value);
	const issuesByInput = value.map((_input, index) =>
		readEditorFormValidationIssuesFn(validationIssues, [
			index,
		]),
	);
	const invalidInputIndex = useFormValidationFocusIndex(value as object);
	const replaceAtFn = (index: number, input: LineInputSchema.Type) => {
		const next = value.map((current, currentIndex) =>
			currentIndex === index ? input : current,
		);
		onChangeFn(next);
	};
	return (
		<section className="grid min-w-0 content-start gap-3">
			<EditorFormSectionDivider
				description={
					allowMaterials ? (
						<Mx label="Production inputs help" />
					) : (
						<Mx label="Action inputs help" />
					)
				}
				title={translator.textFn("Inputs")}
				variant="secondary"
			/>
			<EditorCollectionSelector
				dataUi="EditorInputsCollection"
				initialSelectedIndex={inputIndex}
				key={inputIndex}
				count={value.length}
				error={readRequiredEditorCollectionErrorFn(
					validationIssues,
					value.length,
					1,
					translator.textFn("Add at least one input."),
				)}
				itemLabelFn={(index) => {
					const input = value[index];
					if (input.type === "materials")
						return `${translator.textFn("Material input")} ${index + 1} — ${readItemLabelFn(
							input.query.selector.itemId,
							translator.textFn("No item selected"),
						)}`;
					if (input.type === "units" && input.units?.from === "self")
						return `${translator.textFn("Self-paid units input")} ${index + 1}`;
					if (input.type === "units")
						return `${translator.textFn("Units input")} ${index + 1} — ${readItemLabelFn(
							input.query.selector.itemId,
							translator.textFn("No item selected"),
						)}`;
					return `${translator.textFn("Simple input")} ${index + 1}`;
				}}
				itemSearchTermsFn={(index) => {
					const input = value[index];
					if (input.type === "materials")
						return [
							input.query.selector.itemId,
						];
					if (input.type === "units") {
						const itemId = input.query.selector.itemId;
						if (itemId.length === 0) return [];
						return [
							itemId,
							readItemLabelFn(itemId, ""),
						];
					}
					return [];
				}}
				label={translator.textFn(allowMaterials ? "Line inputs" : "Action inputs")}
				renderItemContentFn={(index, label) => {
					const input = value[index];
					if (input.type === "materials") {
						const { min, max } = input.quantity;
						return (
							<EditorCollectionOption
								label={label}
								details={
									<span className="text-xs text-subtle">
										{min === max ? `×${min}` : `×${min}–${max}`}
										{" · "}
										{translator.textFn(
											input.mode === "consume" ? "Consume" : "Reserve",
										)}
									</span>
								}
							>
								<EditorItemThumbnail
									size="md"
									className="rounded-md"
									resourceIds={
										project.config.items[input.query.selector.itemId]?.artwork
											.default ?? [
											"",
										]
									}
								/>
							</EditorCollectionOption>
						);
					}
					if (input.type === "units") {
						const units = input.units ?? DraftDefaults.inputs.units.units;
						const itemId = input.query.selector.itemId;
						return (
							<EditorCollectionOption
								label={label}
								details={
									<span className="text-xs text-subtle">
										{translator.textFn(
											units.from === "self" ? "Self" : "Target",
										)}
										{units.from === "target"
											? ` · ${translator.textFn(BoardDistancePresentation[input.query.distance].label)}`
											: null}
										{" · "}
										{translator.textFn("Cost")}: {units.cost}
									</span>
								}
							>
								{itemId.length === 0 ? null : (
									<EditorItemThumbnail
										className="rounded-md"
										resourceIds={
											project.config.items[itemId]?.artwork.default ?? [
												"",
											]
										}
										size="md"
									/>
								)}
							</EditorCollectionOption>
						);
					}
					return label;
				}}
				onAddFn={() =>
					onChangeFn([
						...value,
						structuredClone(DraftDefaults.inputs.simple),
					])
				}
				onDuplicateFn={(index) =>
					onChangeFn([
						...value.slice(0, index + 1),
						structuredClone(value[index]),
						...value.slice(index + 1),
					])
				}
				onRemoveFn={(index) =>
					onChangeFn(value.filter((_current, currentIndex) => currentIndex !== index))
				}
				removeDisabled={!emptyAllowed && value.length === 1}
				selectedIndex={invalidInputIndex}
			>
				{(index) => (
					<InputControl
						allowMaterials={allowMaterials}
						input={value[index]}
						issues={issuesByInput[index]}
						ownerItemId={itemId}
						selfUnitsEnabled={selfUnitsEnabled}
						onChangeFn={(next) => replaceAtFn(index, next)}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};

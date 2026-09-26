import { match } from "ts-pattern";
import { Flame, LockKeyhole, Crosshair, LocateFixed } from "lucide-react";
import type { ActionMenuOption } from "~/ui/ui/ActionMenu";
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
import { Mx } from "~/translation/ui/Mx";
import { BoardDistancePresentation } from "~/item-query/ui/QueryPresentation";

interface InputsControlProps {
	readonly allowMaterials?: boolean;
	readonly onChangeFn: (inputs: LineInputSchema.Type[]) => void;
	readonly value: ReadonlyArray<LineInputSchema.Type>;
}

/** Assembles immediate input requirements, optionally including Line-owned materials. */
export const InputsControl = ({ allowMaterials = true, onChangeFn, value }: InputsControlProps) => {
	const translator = useTranslator();
	const project = useEditorProject();
	const readItemLabelFn = useEditorItemOptionLabel();
	const { form, itemUid, inputIndex } = useFormSession();
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
	const addInputFn = (input: LineInputSchema.Type) =>
		onChangeFn([
			...value,
			structuredClone(input),
		]);
	const addOptions: ActionMenuOption[] = [
		...(allowMaterials
			? [
					{
						id: "materials-consume",
						label: `${translator.textFn("Materials")} — ${translator.textFn("Consume")}`,
						description: translator.textFn(
							"Consume delivered items when production finishes.",
						),
						icon: <Flame className="size-5" />,
						onSelectFn: () => addInputFn(DraftDefaults.inputs.materials),
					},
					{
						id: "materials-reserve",
						label: `${translator.textFn("Materials")} — ${translator.textFn("Reserve")}`,
						description: translator.textFn("Hold delivered items, then return them."),
						icon: <LockKeyhole className="size-5" />,
						onSelectFn: () =>
							addInputFn({
								...DraftDefaults.inputs.materials,
								mode: "reserve",
							}),
					},
				]
			: []),
		{
			id: "units-target",
			label: `${translator.textFn("Units")} — ${translator.textFn("Target")}`,
			description: translator.textFn("Spend units from a matching Board item."),
			icon: <Crosshair className="size-5" />,
			onSelectFn: () => addInputFn(DraftDefaults.inputs.units),
		},
		{
			id: "units-self",
			label: `${translator.textFn("Units")} — ${translator.textFn("Self")}`,
			description: translator.textFn(
				selfUnitsEnabled
					? "Spend this item's own units."
					: "Enable Units on this item before selecting Self.",
			),
			icon: <LocateFixed className="size-5" />,
			disabled: !selfUnitsEnabled,
			onSelectFn: () =>
				addInputFn({
					...DraftDefaults.inputs.units,
					units: {
						...DraftDefaults.inputs.units.units,
						from: "self",
					},
					query: {
						distance: "self",
						selector: {
							type: "item",
							itemUid,
						},
					},
				}),
		},
	];
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
				itemLabelFn={(index) =>
					match(value[index])
						.with(
							{
								type: "materials",
							},
							(input) =>
								`${translator.textFn("Material input")} ${index + 1} · ${translator.textFn(input.mode === "consume" ? "Consume" : "Reserve")} — ${readItemLabelFn(
									input.query.selector.itemUid,
									translator.textFn("No item selected"),
								)}`,
						)
						.with(
							{
								type: "units",
								units: {
									from: "self",
								},
							},
							() => `${translator.textFn("Self-paid units input")} ${index + 1}`,
						)
						.with(
							{
								type: "units",
							},
							(input) =>
								`${translator.textFn("Units input")} ${index + 1} — ${readItemLabelFn(
									input.query.selector.itemUid,
									translator.textFn("No item selected"),
								)}`,
						)
						.exhaustive()
				}
				itemSearchTermsFn={(index) => {
					const input = value[index];
					if (input.type === "materials")
						return [
							input.query.selector.itemUid,
						];
					if (input.type === "units") {
						const itemUid = input.query.selector.itemUid;
						if (itemUid.length === 0) return [];
						return [
							itemUid,
							readItemLabelFn(itemUid, ""),
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
									resourceUids={
										project.config.items[input.query.selector.itemUid]?.artwork
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
						const itemUid = input.query.selector.itemUid;
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
								{itemUid.length === 0 ? null : (
									<EditorItemThumbnail
										className="rounded-md"
										resourceUids={
											project.config.items[itemUid]?.artwork.default ?? [
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
				addOptions={addOptions}
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
				selectedIndex={invalidInputIndex}
			>
				{(index) => (
					<InputControl
						input={value[index]}
						issues={issuesByInput[index]}
						selfUnitsEnabled={selfUnitsEnabled}
						onChangeFn={(next) => replaceAtFn(index, next)}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};

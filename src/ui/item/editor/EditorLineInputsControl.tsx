import { match } from "ts-pattern";

import type { EditorInput, EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { Button } from "~/ui/button/Button";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorQuantityControl } from "~/ui/item/editor/EditorQuantityControl";
import { EditorQueryControl } from "~/ui/item/editor/EditorQueryControl";
import { EditorSelectorControl } from "~/ui/item/editor/EditorSelectorControl";
import { useEditorItemOptionLabel } from "~/ui/item/editor/useEditorItemOptionLabel";

const EditorInputCharges = ({
	input,
	onChange,
}: {
	readonly input: EditorInput;
	readonly onChange: (input: EditorInput) => void;
}) => {
	const charges = input.charges;
	return (
		<div className="grid gap-3 border-t border-line pt-3">
			{charges === undefined ? (
				<EditorCapabilityStatus
					actionLabel="Enable charge cost"
					description="This input currently starts jobs without spending charges. Enable a cost to charge this item or its selected target when the job starts."
					icon="icon-[lucide--battery-medium]"
					onEnable={() =>
						onChange({
							...input,
							charges: {
								cost: 1,
								from: "self",
							},
						})
					}
					title="Charge cost is disabled"
				/>
			) : (
				<>
					<div className="flex items-center justify-between gap-3">
						<div>
							<h4 className="text-sm font-semibold">Charge cost</h4>
							<p className="mt-1 text-xs text-muted">
								Optional charge payment when this input starts a job.
							</p>
						</div>
						<Button
							onClick={() =>
								onChange({
									...input,
									charges: undefined,
								})
							}
						>
							Disable charge cost
						</Button>
					</div>
					<div className="grid gap-3 sm:grid-cols-2">
						<EditorNumberControl
							label="Charge cost"
							value={charges.cost}
							min={1}
							onChange={(cost) =>
								onChange({
									...input,
									charges: {
										...charges,
										cost,
									},
								})
							}
						/>
						<EditorChoiceControl
							label="Paid by"
							value={charges.from}
							options={[
								{
									label: "Self",
									value: "self",
								},
								{
									label: "Target",
									value: "target",
								},
							]}
							onChange={(from) =>
								onChange({
									...input,
									charges: {
										...charges,
										from,
									},
								})
							}
						/>
					</div>
				</>
			)}
		</div>
	);
};

const EditorLineInput = ({
	input,
	onChange,
}: {
	readonly input: EditorInput;
	readonly onChange: (input: EditorInput) => void;
}) => {
	return (
		<article className="grid gap-4">
			<EditorChoiceControl
				label="Input type"
				value={input.type}
				options={[
					{
						label: "Simple",
						value: "simple",
					},
					{
						label: "Materials",
						value: "materials",
					},
					{
						label: "Deposit",
						value: "deposit",
					},
				]}
				onChange={(type) => onChange(structuredClone(EditorItemDraftDefaults.inputs[type]))}
			/>
			{match(input)
				.with(
					{
						type: "simple",
					},
					() => (
						<p className="text-xs text-muted">
							This marker has no consumable resource requirement.
						</p>
					),
				)
				.with(
					{
						type: "materials",
					},
					(material) => (
						<div className="grid gap-4">
							<EditorSelectorControl
								value={material.selector}
								onChange={(selector) =>
									onChange({
										...material,
										selector,
									})
								}
							/>
							<div className="grid gap-3 sm:grid-cols-2">
								<EditorChoiceControl
									label="Material mode"
									value={material.mode}
									options={[
										{
											label: "Consume",
											value: "consume",
										},
										{
											label: "Reserve",
											value: "reserve",
										},
									]}
									onChange={(mode) =>
										onChange({
											...material,
											mode,
										})
									}
								/>
								<EditorNumberControl
									label="Extra buffer capacity"
									value={material.capacity}
									min={0}
									onChange={(capacity) =>
										onChange({
											...material,
											capacity,
										})
									}
								/>
							</div>
							<EditorQuantityControl
								value={material.quantity}
								onChange={(quantity) =>
									onChange({
										...material,
										quantity,
									})
								}
							/>
						</div>
					),
				)
				.with(
					{
						type: "deposit",
					},
					(deposit) => (
						<EditorQueryControl
							scopeLocked
							value={deposit.query}
							onChange={(query) =>
								match(query)
									.with(
										{
											scope: "board",
										},
										(boardQuery) =>
											onChange({
												...deposit,
												query: boardQuery,
											}),
									)
									.otherwise(() => undefined)
							}
						/>
					),
				)
				.exhaustive()}
			<EditorInputCharges
				input={input}
				onChange={onChange}
			/>
		</article>
	);
};

export interface EditorLineInputsControlProps {
	readonly onChange: (inputs: EditorLine["input"]) => void;
	readonly value: EditorLine["input"];
}

/** Edits every discriminated input requirement owned by one product line. */
export const EditorLineInputsControl = ({ onChange, value }: EditorLineInputsControlProps) => {
	const readItemLabel = useEditorItemOptionLabel();
	const replaceAt = (index: number, input: EditorInput) => {
		const next = value.map((current, currentIndex) =>
			currentIndex === index ? input : current,
		) as EditorLine["input"];
		onChange(next);
	};
	return (
		<section className="grid min-w-0 content-start gap-3">
			<header>
				<div className="flex items-center gap-1">
					<h3 className="text-sm font-semibold">Inputs</h3>
					<EditorInfoTooltip content="Inputs belong only to this production line. Every configured input contract must be satisfiable before a job can start; a Simple input explicitly requires no material." />
				</div>
				<p className="mt-1 text-xs text-muted">
					At least one explicit input contract is required.
				</p>
			</header>
			<EditorCollectionSelector
				addLabel="Add input"
				count={value.length}
				itemLabel={(index) => {
					const input = value[index];
					if (input.type === "materials")
						return `${readItemLabel(input.selector.itemId, `Material input ${index + 1}`)} — Materials`;
					if (input.type === "deposit")
						return `${readItemLabel(input.query.selector.itemId, `Deposit input ${index + 1}`)} — Deposit`;
					return `Simple input ${index + 1}`;
				}}
				label="Line inputs"
				onAdd={() =>
					onChange([
						...value,
						structuredClone(EditorItemDraftDefaults.inputs.simple),
					])
				}
				onRemove={
					value.length === 1
						? undefined
						: (index) =>
								onChange(
									value.filter(
										(_current, currentIndex) => currentIndex !== index,
									) as EditorLine["input"],
								)
				}
				removeLabel="Remove input"
			>
				{(index) => (
					<EditorLineInput
						input={value[index]}
						onChange={(next) => replaceAt(index, next)}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};

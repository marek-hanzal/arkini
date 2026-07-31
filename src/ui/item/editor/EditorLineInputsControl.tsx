import { match } from "ts-pattern";

import type { EditorInput, EditorLine } from "~/bridge/editor/EditorItemModel";
import { createEditorInputDraft } from "~/bridge/editor/createEditorItemDraft";
import { Button } from "~/ui/button/Button";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorQuantityControl } from "~/ui/item/editor/EditorQuantityControl";
import { EditorQueryControl } from "~/ui/item/editor/EditorQueryControl";
import { EditorSelectorControl } from "~/ui/item/editor/EditorSelectorControl";

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
							charges:
								input.charges === undefined
									? {
											cost: 1,
											from: "self",
										}
									: undefined,
						})
					}
				>
					{input.charges === undefined ? "Add charge cost" : "Remove charge cost"}
				</Button>
			</div>
			{charges === undefined ? null : (
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
			)}
		</div>
	);
};

const EditorLineInput = ({
	index,
	input,
	onChange,
	onRemove,
}: {
	readonly index: number;
	readonly input: EditorInput;
	readonly onChange: (input: EditorInput) => void;
	readonly onRemove: () => void;
}) => {
	return (
		<article className="grid gap-4 rounded-xl border border-line bg-canvas/35 p-3">
			<header className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-semibold">Input {index + 1}</h3>
				<Button onClick={onRemove}>Remove</Button>
			</header>
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
				onChange={(type) => onChange(createEditorInputDraft(type))}
			/>
			{match(input)
				.with(
					{
						type: "simple",
					},
					() => (
						<p className="rounded-lg border border-line bg-surface/60 p-3 text-xs text-muted">
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
	const replaceAt = (index: number, input: EditorInput) => {
		const next = value.map((current, currentIndex) =>
			currentIndex === index ? input : current,
		) as EditorLine["input"];
		onChange(next);
	};
	return (
		<section className="grid gap-3 border-t border-line pt-4">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h3 className="text-sm font-semibold">Inputs</h3>
					<p className="mt-1 text-xs text-muted">
						At least one explicit input contract is required.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{(
						[
							"simple",
							"materials",
							"deposit",
						] as const
					).map((type) => (
						<Button
							key={type}
							onClick={() =>
								onChange([
									...value,
									createEditorInputDraft(type),
								])
							}
						>
							Add {type}
						</Button>
					))}
				</div>
			</header>
			{value.map((input, index) => (
				<EditorLineInput
					key={`${index}:${input.type}`}
					index={index}
					input={input}
					onChange={(next) => replaceAt(index, next)}
					onRemove={() => {
						if (value.length === 1) return;
						onChange(
							value.filter(
								(_current, currentIndex) => currentIndex !== index,
							) as EditorLine["input"],
						);
					}}
				/>
			))}
		</section>
	);
};

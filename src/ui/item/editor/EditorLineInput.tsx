import { match } from "ts-pattern";

import type { EditorInput } from "~/bridge/item/editor/EditorItemModel";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorInputCharges } from "~/ui/item/editor/EditorInputCharges";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorQuantityControl } from "~/ui/item/editor/EditorQuantityControl";
import { EditorQueryControl } from "~/ui/item/editor/EditorQueryControl";
import { EditorSelectorControl } from "~/ui/item/editor/EditorSelectorControl";

export const EditorLineInput = ({
	input,
	onChange,
}: {
	readonly input: EditorInput;
	readonly onChange: (input: EditorInput) => void;
}) => (
	<article className="grid gap-4">
		<EditorChoiceControl
			label="Input type"
			description="Simple explicitly requires no consumable resource. Materials consume or reserve an item, while Deposit targets a matching board deposit."
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
				() => null,
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

import { match } from "ts-pattern";

import type { EditorQuantity } from "~/bridge/item/editor/EditorItemModel";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";

export interface EditorQuantityControlProps {
	readonly label?: string;
	readonly onChange: (quantity: EditorQuantity) => void;
	readonly value: EditorQuantity;
}

/** Edits a fixed or bounded positive quantity without leaking union checks to callers. */
export const EditorQuantityControl = ({
	label = "Quantity",
	onChange,
	value,
}: EditorQuantityControlProps) => (
	<div className="grid gap-3">
		<EditorChoiceControl
			label={label}
			value={value.type}
			options={[
				{
					label: "Fixed",
					value: "value",
				},
				{
					label: "Range",
					value: "range",
				},
			]}
			onChange={(type) =>
				onChange(
					type === "value"
						? {
								type,
								value: value.type === "value" ? value.value : value.min,
							}
						: {
								type,
								min: value.type === "range" ? value.min : value.value,
								max: value.type === "range" ? value.max : value.value,
							},
				)
			}
		/>
		{match(value)
			.with(
				{
					type: "value",
				},
				(quantity) => (
					<EditorNumberControl
						label="Value"
						value={quantity.value}
						min={1}
						onChange={(next) =>
							onChange({
								...quantity,
								value: next,
							})
						}
					/>
				),
			)
			.with(
				{
					type: "range",
				},
				(quantity) => (
					<div className="grid gap-3 sm:grid-cols-2">
						<EditorNumberControl
							label="Minimum"
							value={quantity.min}
							min={1}
							onChange={(min) =>
								onChange({
									...quantity,
									min,
								})
							}
						/>
						<EditorNumberControl
							label="Maximum"
							value={quantity.max}
							min={quantity.min}
							onChange={(max) =>
								onChange({
									...quantity,
									max,
								})
							}
						/>
					</div>
				),
			)
			.exhaustive()}
	</div>
);

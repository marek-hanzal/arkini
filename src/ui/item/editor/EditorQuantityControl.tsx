import type { EditorQuantity } from "~/bridge/item/editor/EditorItemModel";
import { EditorNumberControl } from "~/ui/form/EditorValueControls";

export interface EditorQuantityControlProps {
	readonly label?: string;
	readonly onChange: (quantity: EditorQuantity) => void;
	readonly value: EditorQuantity;
}

/** Renders the reusable minimum and maximum quantity fields without imposing layout. */
export const EditorQuantityFields = ({
	onChange,
	value,
}: Omit<EditorQuantityControlProps, "label">) => (
	<>
		<EditorNumberControl
			label="Minimum"
			value={value.min}
			min={1}
			onChange={(min) =>
				onChange({
					...value,
					min,
				})
			}
		/>
		<EditorNumberControl
			label="Maximum"
			value={value.max}
			min={value.min}
			onChange={(max) =>
				onChange({
					...value,
					max,
				})
			}
		/>
	</>
);

/** Edits the required inclusive positive quantity bounds. */
export const EditorQuantityControl = ({
	label = "Quantity",
	onChange,
	value,
}: EditorQuantityControlProps) => (
	<div className="grid gap-3">
		<span className="text-sm font-semibold text-foreground">{label}</span>
		<div className="grid gap-3 sm:grid-cols-2">
			<EditorQuantityFields
				value={value}
				onChange={onChange}
			/>
		</div>
	</div>
);

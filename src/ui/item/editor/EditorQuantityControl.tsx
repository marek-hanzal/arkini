import type { ReactNode } from "react";

import type { EditorQuantity } from "~/bridge/item/editor/EditorItemModel";
import { EditorNumberControl, EditorValueLabel } from "~/ui/form/EditorValueControls";

export interface EditorQuantityControlProps {
	readonly description?: ReactNode;
	readonly descriptionTooltipClassName?: string;
	readonly label?: string;
	readonly maximumDescription?: string;
	readonly minimumDescription?: string;
	readonly onChange: (quantity: EditorQuantity) => void;
	readonly value: EditorQuantity;
}

/** Renders the reusable minimum and maximum quantity fields without imposing layout. */
export const EditorQuantityFields = ({
	maximumDescription,
	minimumDescription,
	onChange,
	value,
}: Omit<EditorQuantityControlProps, "description" | "descriptionTooltipClassName" | "label">) => (
	<>
		<EditorNumberControl
			description={minimumDescription}
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
			description={maximumDescription}
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
	description,
	descriptionTooltipClassName,
	label = "Quantity",
	maximumDescription,
	minimumDescription,
	onChange,
	value,
}: EditorQuantityControlProps) => (
	<div className="grid gap-3">
		<div className="text-sm">
			<EditorValueLabel
				description={description}
				label={label}
				tooltipClassName={descriptionTooltipClassName}
			/>
		</div>
		<div className="grid gap-3 sm:grid-cols-2">
			<EditorQuantityFields
				maximumDescription={maximumDescription}
				minimumDescription={minimumDescription}
				value={value}
				onChange={onChange}
			/>
		</div>
	</div>
);

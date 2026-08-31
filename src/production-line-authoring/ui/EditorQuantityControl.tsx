import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import type { ReactNode } from "react";
import { EditorNumberControl, EditorValueLabel } from "~/editor-control/ui/EditorValueControls";

interface EditorQuantityControlProps {
	readonly description?: ReactNode;
	readonly label?: string;
	readonly maximumDescription?: string;
	readonly minimumDescription?: string;
	readonly onChange: (quantity: QuantitySchema.Type) => void;
	readonly value: QuantitySchema.Type;
}

/** Renders the reusable minimum and maximum quantity fields without imposing layout. */
export const EditorQuantityFields = ({
	maximumDescription,
	minimumDescription,
	onChange,
	value,
}: Omit<EditorQuantityControlProps, "description" | "label">) => (
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

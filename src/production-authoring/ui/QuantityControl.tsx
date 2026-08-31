import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import type { ReactNode } from "react";
import { EditorNumberControl, EditorValueLabel } from "~/editor-control/ui/EditorValueControls";

interface QuantityControlProps {
	readonly description?: ReactNode;
	readonly label?: string;
	readonly maximumDescription?: string;
	readonly minimumDescription?: string;
	readonly onChangeFn: (quantity: QuantitySchema.Type) => void;
	readonly value: QuantitySchema.Type;
}

/** Renders the reusable minimum and maximum quantity fields without imposing layout. */
export const QuantityFields = ({
	maximumDescription,
	minimumDescription,
	onChangeFn,
	value,
}: Omit<QuantityControlProps, "description" | "label">) => (
	<>
		<EditorNumberControl
			description={minimumDescription}
			label="Minimum"
			value={value.min}
			min={1}
			onChangeFn={(min) =>
				onChangeFn({
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
			onChangeFn={(max) =>
				onChangeFn({
					...value,
					max,
				})
			}
		/>
	</>
);

/** Edits the required inclusive positive quantity bounds. */
export const QuantityControl = ({
	description,
	label = "Quantity",
	maximumDescription,
	minimumDescription,
	onChangeFn,
	value,
}: QuantityControlProps) => (
	<div className="grid gap-3">
		<div className="text-sm">
			<EditorValueLabel
				description={description}
				label={label}
			/>
		</div>
		<div className="grid gap-3 sm:grid-cols-2">
			<QuantityFields
				maximumDescription={maximumDescription}
				minimumDescription={minimumDescription}
				value={value}
				onChangeFn={onChangeFn}
			/>
		</div>
	</div>
);

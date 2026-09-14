import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import type { ReactNode } from "react";
import { EditorNumberControl } from "~/editor-control/ui/EditorValueControls";

interface QuantityControlProps {
	readonly maximumError?: string;
	readonly maximumDescription?: ReactNode;
	readonly maximumLabel?: string;
	readonly minimumError?: string;
	readonly minimumDescription?: ReactNode;
	readonly minimumLabel?: string;
	readonly minimumValue?: number;
	readonly onChangeFn: (quantity: QuantitySchema.Type) => void;
	readonly value: QuantitySchema.Type;
}

/** Renders the reusable minimum and maximum quantity fields without imposing layout. */
export const QuantityFields = ({
	maximumError,
	maximumDescription,
	maximumLabel = "Maximum",
	minimumError,
	minimumDescription,
	minimumLabel = "Minimum",
	minimumValue = 1,
	onChangeFn,
	value,
}: QuantityControlProps) => (
	<>
		<EditorNumberControl
			description={minimumDescription}
			error={minimumError}
			label={minimumLabel}
			value={value.min}
			min={minimumValue}
			onChangeFn={(min) =>
				onChangeFn({
					...value,
					min,
					max: min > value.max ? min : value.max,
				})
			}
		/>
		<EditorNumberControl
			description={maximumDescription}
			error={maximumError}
			label={maximumLabel}
			value={value.max}
			min={minimumValue}
			onChangeFn={(max) =>
				onChangeFn({
					...value,
					min: max < value.min ? max : value.min,
					max,
				})
			}
		/>
	</>
);

/** Edits the required inclusive positive quantity bounds. */
export const QuantityControl = ({
	maximumDescription,
	maximumError,
	minimumDescription,
	minimumError,
	onChangeFn,
	value,
}: QuantityControlProps) => (
	<div className="grid gap-3 sm:grid-cols-2">
		<QuantityFields
			maximumError={maximumError}
			maximumDescription={maximumDescription}
			minimumError={minimumError}
			minimumDescription={minimumDescription}
			value={value}
			onChangeFn={onChangeFn}
		/>
	</div>
);

import type { UnitCostSchema } from "~/production-input/schema/UnitCostSchema";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Renders one canonical human-readable unit cost across Editor and Game. */
export const UnitCostValue = ({ unit }: { readonly unit: UnitCostSchema.Type }) => {
	const translator = useTranslator();
	const label =
		unit.from === "self"
			? unit.cost === 1
				? translator.textFn("unit from owner")
				: translator.textFn("units from owner")
			: unit.cost === 1
				? translator.textFn("unit from target")
				: translator.textFn("units from target");
	return (
		<>
			{unit.cost} {label}
		</>
	);
};

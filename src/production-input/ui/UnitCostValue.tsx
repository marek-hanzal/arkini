import { match } from "ts-pattern";

import type { UnitCostSchema } from "~/production-input/schema/UnitCostSchema";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Renders one canonical human-readable unit cost across Editor and Game. */
export const UnitCostValue = ({ unit }: { readonly unit: UnitCostSchema.Type }) => {
	const translator = useTranslator();
	const label = match({
		from: unit.from,
		singular: unit.cost === 1,
	})
		.with(
			{
				from: "self",
				singular: true,
			},
			() => translator.textFn("unit from owner"),
		)
		.with(
			{
				from: "self",
				singular: false,
			},
			() => translator.textFn("units from owner"),
		)
		.with(
			{
				from: "target",
				singular: true,
			},
			() => translator.textFn("unit from target"),
		)
		.with(
			{
				from: "target",
				singular: false,
			},
			() => translator.textFn("units from target"),
		)
		.exhaustive();
	return (
		<>
			{unit.cost} {label}
		</>
	);
};

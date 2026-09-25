import { useFormSession } from "~/item-authoring/ui/FormContext";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Mx } from "~/translation/ui/Mx";

/** Authors the item interface on the Item page. */
export const ItemInterfaceField = () => {
	const { form } = useFormSession();
	const translator = useTranslator();
	return (
		<form.AppField name="ui">
			{(field) => (
				<field.ChoiceField
					label={translator.textFn("Item interface")}
					description={<Mx label="Item interface help" />}
					options={[
						{
							label: translator.textFn("Simple"),
							value: "simple",
						},
						{
							label: translator.textFn("Default"),
							value: "default",
						},
					]}
				/>
			)}
		</form.AppField>
	);
};

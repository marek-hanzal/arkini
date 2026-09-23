import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";
import { useTranslator } from "~/translation/ui/useTranslator";
import { PanelsTopLeft } from "lucide-react";

/** Selects a reusable template identity without claiming exclusive use of its layout. */
export const TemplateSelector = ({
	templates,
	value,
	onChangeFn,
	error,
}: {
	readonly templates: readonly TemplateSchema.Type[];
	readonly value: string;
	readonly onChangeFn: (uid: string) => void;
	readonly error?: string;
}) => {
	const translator = useTranslator();
	const options = templates.map((template) => ({
		id: template.uid,
		label: template.title,
		meta: `${template.width} × ${template.height} = ${template.width * template.height} · ${template.board.length} ${translator.textFn("Items")}`,
		terms: [
			template.title,
			template.uid,
		],
	}));

	return (
		<EditorSearchCombobox
			label={translator.textFn("Template")}
			placeholder={translator.textFn("Search templates...")}
			emptyLabel={translator.textFn("No matching templates")}
			displaySelectedLabel
			value={value}
			error={error}
			onChangeFn={onChangeFn}
			options={options}
			description={options.find((option) => option.id === value)?.meta}
			renderPreviewFn={() => <PanelsTopLeft className="size-5 text-accent" />}
		/>
	);
};

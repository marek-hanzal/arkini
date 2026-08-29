import { useMemo } from "react";

import { useEditorProject } from "~/authoring-session/useEditorProject";
import { useFieldContext } from "~/ui/form/EditorFormContexts";
import { readEditorFieldErrorFn } from "~/ui/form/fn/readEditorFieldErrorFn";
import { EditorSearchCombobox, type EditorSearchOption } from "~/ui/form/EditorSearchCombobox";
import { EditorAssetThumbnail } from "~/ui/resource/editor/EditorAssetThumbnail";

export interface EditorAssetAutocompleteFieldProps {
	readonly description?: string;
	readonly label: string;
}

const readAssetName = (id: string) =>
	id.replaceAll(/[-_]+/g, " ").replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());

/** Picks one PNG asset known by the active editor project. */
export const EditorAssetAutocompleteField = ({
	description,
	label,
}: EditorAssetAutocompleteFieldProps) => {
	const field = useFieldContext<string>();
	const error = readEditorFieldErrorFn(field.state.meta.errors);
	const project = useEditorProject();
	const options = useMemo(
		() =>
			project.resources.map(
				(resource) =>
					({
						id: resource.id,
						label: readAssetName(resource.id),
						meta: resource.id,
						terms: [
							resource.id,
							readAssetName(resource.id),
						],
					}) satisfies EditorSearchOption,
			),
		[
			project.resources,
		],
	);
	return (
		<EditorSearchCombobox
			label={label}
			description={description}
			emptyLabel="No known asset matches this search."
			error={error}
			options={options}
			value={field.state.value}
			onBlur={field.handleBlur}
			onChange={field.handleChange}
			renderPreview={(option) => <EditorAssetThumbnail resourceId={option.id} />}
			renderSelectedPreview={(option) => (
				<EditorAssetThumbnail
					resourceId={option.id}
					size="sm"
				/>
			)}
		/>
	);
};

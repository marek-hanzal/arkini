import { useMemo } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useFieldContext } from "~/editor-control/ui/EditorFormContexts";
import { readEditorFieldErrorFn } from "~/editor-control/fn/readEditorFieldErrorFn";
import {
	EditorSearchCombobox,
	type EditorSearchOption,
} from "~/editor-control/ui/EditorSearchCombobox";
import { EditorAssetThumbnail } from "~/authoring-form/ui/EditorAssetThumbnail";

interface AssetAutocompleteFieldProps {
	readonly description?: string;
	readonly label: string;
}

const readAssetNameFn = (id: string) =>
	id.replaceAll(/[-_]+/g, " ").replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());

/** Picks one PNG asset known by the active editor project. */
export const AssetAutocompleteField = ({ description, label }: AssetAutocompleteFieldProps) => {
	const field = useFieldContext<string>();
	const error = readEditorFieldErrorFn(field.state.meta.errors);
	const project = useEditorProject();
	const options = useMemo(
		() =>
			project.resources.map((resource) => {
				const label = readAssetNameFn(resource.id);
				return {
					id: resource.id,
					label,
					meta: resource.id,
					terms: [
						resource.id,
						label,
					],
				} satisfies EditorSearchOption;
			}),
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
			onBlurFn={field.handleBlur}
			onChangeFn={field.handleChange}
			renderPreviewFn={(option) => <EditorAssetThumbnail resourceId={option.id} />}
			renderSelectedPreviewFn={(option) => (
				<EditorAssetThumbnail
					resourceId={option.id}
					size="sm"
				/>
			)}
		/>
	);
};

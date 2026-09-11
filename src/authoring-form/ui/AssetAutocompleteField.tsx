import { useMemo } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useFieldContext } from "~/editor-control/ui/EditorFormContexts";
import { readEditorFieldErrorFn } from "~/editor-control/fn/readEditorFieldErrorFn";
import {
	EditorSearchCombobox,
	type EditorSearchOption,
} from "~/editor-control/ui/EditorSearchCombobox";
import { EditorAssetThumbnail } from "~/authoring-form/ui/EditorAssetThumbnail";
import { readAssetNameFn } from "~/asset-authoring/fn/readAssetNameFn";

import type { Project } from "~/project-authoring/type/Project";

interface AssetAutocompleteFieldProps {
	readonly description?: string;
	readonly label: string;
	readonly optional?: boolean;
}

/** Picks one PNG asset known by the active editor project. */
export const AssetAutocompleteField = ({
	description,
	label,
	optional = false,
}: AssetAutocompleteFieldProps) => {
	const field = useFieldContext<string>();
	const error = readEditorFieldErrorFn(field.state.meta.errors);
	return (
		<EditorAssetReferenceControl
			label={label}
			description={description}
			error={error}
			optional={optional}
			value={field.state.value}
			onBlurFn={field.handleBlur}
			onChangeFn={field.handleChange}
		/>
	);
};

interface EditorAssetReferenceControlProps extends AssetAutocompleteFieldProps {
	readonly value: string;
	readonly error?: string;
	readonly includeResourceFn?: (resource: Project.Resource) => boolean;
	readonly onBlurFn?: () => void;
	readonly onChangeFn: (resourceId: string) => void;
}

/** Reuses the canonical asset autocomplete outside direct form field bindings. */
export const EditorAssetReferenceControl = ({
	label,
	description,
	optional = true,
	value,
	error,
	includeResourceFn,
	onBlurFn,
	onChangeFn,
}: EditorAssetReferenceControlProps) => {
	const project = useEditorProject();
	const options = useMemo(
		() =>
			project.resources
				.filter((resource) => includeResourceFn?.(resource) ?? true)
				.map((resource) => {
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
			includeResourceFn,
		],
	);
	return (
		<EditorSearchCombobox
			label={label}
			description={description}
			emptyLabel="No known asset matches this search."
			error={error}
			options={options}
			required={!optional}
			value={value}
			onBlurFn={onBlurFn}
			onChangeFn={onChangeFn}
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

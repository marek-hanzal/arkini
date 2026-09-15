import { useMemo } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useFieldContext } from "~/editor-control/ui/EditorFormContexts";
import { readEditorFieldErrorFn } from "~/editor-control/fn/readEditorFieldErrorFn";
import {
	EditorSearchCombobox,
	type EditorSearchOption,
} from "~/editor-control/ui/EditorSearchCombobox";
import { EditorResourceThumbnail } from "~/authoring-form/ui/EditorResourceThumbnail";
import { readResourceNameFn } from "~/game-config-resource/fn/readResourceNameFn";

import type { Project } from "~/project-authoring/type/Project";
import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

interface ResourceAutocompleteFieldProps {
	readonly description?: string;
	readonly emptyLabel: string;
	readonly label: string;
	readonly optional?: boolean;
	readonly resourceType?: ResourceTypeSchema.Type;
}

/** Picks one resource of the caller's explicit semantic type. */
export const ResourceAutocompleteField = ({
	description,
	emptyLabel,
	label,
	optional = false,
	resourceType,
}: ResourceAutocompleteFieldProps) => {
	const field = useFieldContext<string>();
	const error = readEditorFieldErrorFn(field.state.meta.errors);
	return (
		<ResourceReferenceControl
			label={label}
			description={description}
			emptyLabel={emptyLabel}
			error={error}
			optional={optional}
			value={field.state.value}
			onBlurFn={field.handleBlur}
			onChangeFn={field.handleChange}
			resourceType={resourceType}
		/>
	);
};

interface ResourceReferenceControlProps extends ResourceAutocompleteFieldProps {
	readonly showSelectedPreview?: boolean;
	readonly value: string;
	readonly error?: string;
	readonly includeResourceFn?: (resource: Project.Resource) => boolean;
	readonly onBlurFn?: () => void;
	readonly onChangeFn: (resourceId: string) => void;
}

/** Reuses the canonical typed Resource autocomplete outside direct form field bindings. */
export const ResourceReferenceControl = ({
	label,
	description,
	emptyLabel,
	optional = true,
	value,
	error,
	includeResourceFn,
	onBlurFn,
	onChangeFn,
	showSelectedPreview = true,
	resourceType,
}: ResourceReferenceControlProps) => {
	const project = useEditorProject();
	const options = useMemo(
		() =>
			project.resources
				.filter(
					(resource) =>
						(resourceType === undefined || resource.type === resourceType) &&
						(includeResourceFn?.(resource) ?? true),
				)
				.map((resource) => {
					const label = readResourceNameFn(resource.id);
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
			resourceType,
		],
	);
	return (
		<EditorSearchCombobox
			label={label}
			description={description}
			emptyLabel={emptyLabel}
			error={error}
			options={options}
			required={!optional}
			value={value}
			onBlurFn={onBlurFn}
			onChangeFn={onChangeFn}
			renderPreviewFn={(option) => (
				<EditorResourceThumbnail
					resourceId={option.id}
					size="xl"
				/>
			)}
			renderSelectedPreviewFn={
				showSelectedPreview
					? (option) => (
							<EditorResourceThumbnail
								resourceId={option?.id}
								size="input"
							/>
						)
					: undefined
			}
		/>
	);
};

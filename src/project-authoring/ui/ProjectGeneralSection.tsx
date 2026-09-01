import { ProjectAvatarKeys } from "~/project-authoring/schema/ProjectFormSchema";
import { EditorAssetThumbnail } from "~/authoring-form/ui/EditorAssetThumbnail";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { useProjectFormSession } from "~/project-authoring/ui/ProjectFormContext";

export const ProjectGeneralSection = ({
	initialAvatarIndex = 0,
}: {
	readonly initialAvatarIndex?: number;
}) => {
	const { form } = useProjectFormSession();
	return (
		<div className="grid gap-6">
			<EditorFormSection title="General">
				<EditorFormCard>
					<form.AppField name="title">
						{(field) => <field.TextField label="Title" />}
					</form.AppField>
				</EditorFormCard>
			</EditorFormSection>
			<EditorFormSection
				title="Hero image"
				description="The package-owned image shown by the launcher and game shell."
			>
				<EditorFormCard>
					<form.AppField name="hero">
						{(field) => <field.AssetField label="Hero asset" />}
					</form.AppField>
				</EditorFormCard>
			</EditorFormSection>
			<EditorFormSection
				title="About avatars"
				description="Ordered package-owned images revealed on the /about screen as an easter egg."
			>
				<EditorFormCard>
					<form.AppField
						name="avatars"
						mode="array"
					>
						{(avatarsField) => {
							const avatars = avatarsField.state.value;
							return (
								<EditorCollectionSelector
									addLabel="Add avatar"
									count={avatars.length}
									initialSelectedIndex={initialAvatarIndex}
									itemLabelFn={(index) =>
										ProjectAvatarKeys[index] ?? `Avatar ${index + 1}`
									}
									itemMetaFn={(index) => avatars[index] || "No asset selected"}
									key={initialAvatarIndex}
									label="About avatars"
									onAddFn={
										avatars.length >= ProjectAvatarKeys.length
											? undefined
											: () => avatarsField.pushValue("")
									}
									onRemoveFn={(index) => avatarsField.removeValue(index)}
									removeLabel="Remove avatar"
									renderItemPreviewFn={(index) => (
										<EditorAssetThumbnail
											resourceId={avatars[index]}
											size="sm"
										/>
									)}
								>
									{(index) => (
										<form.AppField name={`avatars[${index}]`}>
											{(field) => <field.AssetField label="Asset" />}
										</form.AppField>
									)}
								</EditorCollectionSelector>
							);
						}}
					</form.AppField>
				</EditorFormCard>
			</EditorFormSection>
		</div>
	);
};

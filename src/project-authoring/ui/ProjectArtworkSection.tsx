import { useTranslator } from "~/translation/ui/useTranslator";
import { Mx } from "~/translation/ui/Mx";
import { EditorAssetThumbnail } from "~/authoring-form/ui/EditorAssetThumbnail";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormBranchEnd } from "~/editor-control/ui/EditorFormBranchEnd";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { ProjectAvatarKeys } from "~/project-authoring/schema/ProjectFormSchema";
import { useProjectFormSession } from "~/project-authoring/ui/ProjectFormContext";

/** Edits the project-wide launcher hero and About portraits. */
export const ProjectArtworkSection = ({
	initialAvatarIndex = 0,
}: {
	readonly initialAvatarIndex?: number;
}) => {
	const translator = useTranslator();
	const { form } = useProjectFormSession();
	return (
		<div className="grid gap-6">
			<EditorFormSection
				title={translator.textFn("Hero image")}
				description={<Mx label="Project hero image help" />}
			>
				<EditorFormCard>
					<form.AppField name="hero">
						{(field) => <field.AssetField label={translator.textFn("Hero asset")} />}
					</form.AppField>
				</EditorFormCard>
			</EditorFormSection>
			<EditorFormSection
				title={translator.textFn("About avatars")}
				description={<Mx label="Project About avatars help" />}
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
									count={avatars.length}
									initialSelectedIndex={initialAvatarIndex}
									itemLabelFn={(index) =>
										ProjectAvatarKeys[index] ??
										`${translator.textFn("Avatar")} ${index + 1}`
									}
									itemMetaFn={(index) =>
										avatars[index] || translator.textFn("No asset selected")
									}
									key={initialAvatarIndex}
									label={translator.textFn("About avatars")}
									onAddFn={
										avatars.length >= ProjectAvatarKeys.length
											? undefined
											: () => avatarsField.pushValue("")
									}
									onRemoveFn={(index) => avatarsField.removeValue(index)}
									renderItemPreviewFn={(index) => (
										<EditorAssetThumbnail
											resourceId={avatars[index]}
											size="sm"
										/>
									)}
								>
									{(index) => (
										<div className="grid gap-3">
											<form.AppField name={`avatars[${index}]`}>
												{(field) => (
													<field.AssetField
														label={translator.textFn("Asset")}
													/>
												)}
											</form.AppField>
											<EditorFormBranchEnd />
										</div>
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

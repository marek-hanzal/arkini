import { EditorProjectAvatarKeys } from "~/bridge/project/editor/EditorProjectFormSchema";
import { Button } from "~/ui/button/Button";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormSection } from "~/ui/form/EditorFormSection";
import { useEditorProjectFormSession } from "~/ui/project/editor/EditorProjectFormContext";

export const EditorProjectAppearanceSection = () => {
	const { form } = useEditorProjectFormSession();
	return (
		<div className="grid gap-6">
			<EditorFormSection
				title="Hero image"
				description="The package-owned image shown by the launcher and game shell."
			>
				<form.AppField name="hero">
					{(field) => <field.AssetField label="Hero asset" />}
				</form.AppField>
			</EditorFormSection>
			<EditorFormSection
				title="About avatars"
				description="Ordered package-owned images revealed on the /about screen as an easter egg."
			>
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
								itemLabel={(index) => avatars[index] || `Avatar ${index + 1}`}
								label="About avatars"
								onAdd={
									avatars.length >= EditorProjectAvatarKeys.length
										? undefined
										: () => avatarsField.pushValue("")
								}
								onRemove={(index) => avatarsField.removeValue(index)}
								removeLabel="Remove avatar"
							>
								{(index, selectIndex) => (
									<div className="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
										<form.AppField name={`avatars[${index}]`}>
											{(field) => <field.AssetField label="Asset" />}
										</form.AppField>
										<div className="flex items-end gap-2">
											<Button
												disabled={index === 0}
												onClick={() => {
													avatarsField.swapValues(index, index - 1);
													selectIndex(index - 1);
												}}
											>
												<span className="icon-[lucide--arrow-up] size-4" />
											</Button>
											<Button
												disabled={index === avatars.length - 1}
												onClick={() => {
													avatarsField.swapValues(index, index + 1);
													selectIndex(index + 1);
												}}
											>
												<span className="icon-[lucide--arrow-down] size-4" />
											</Button>
										</div>
									</div>
								)}
							</EditorCollectionSelector>
						);
					}}
				</form.AppField>
			</EditorFormSection>
		</div>
	);
};

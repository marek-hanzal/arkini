import { ArrowDown, ArrowUp } from "lucide-react";

import { EditorProjectAvatarKeys } from "~/project-authoring/schema/EditorProjectFormSchema";
import { Button } from "~/ui/ui/Button";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { useEditorProjectFormSession } from "~/project-authoring/ui/EditorProjectFormContext";

export const EditorProjectAppearanceSection = ({
	initialAvatarIndex = 0,
}: {
	readonly initialAvatarIndex?: number;
}) => {
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
								initialSelectedIndex={initialAvatarIndex}
								itemLabel={(index) => avatars[index] || `Avatar ${index + 1}`}
								key={initialAvatarIndex}
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
												<ArrowUp className="size-4" />
											</Button>
											<Button
												disabled={index === avatars.length - 1}
												onClick={() => {
													avatarsField.swapValues(index, index + 1);
													selectIndex(index + 1);
												}}
											>
												<ArrowDown className="size-4" />
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

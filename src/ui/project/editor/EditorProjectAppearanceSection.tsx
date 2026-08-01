import { EditorProjectAvatarKeys } from "~/bridge/project/editor/EditorProjectFormSchema";
import { Button } from "~/ui/button/Button";
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
				title="Default avatars"
				description="Ordered package-owned images available to new players."
			>
				<form.AppField
					name="avatars"
					mode="array"
				>
					{(avatarsField) => (
						<div className="grid gap-3">
							{avatarsField.state.value.map((_, index) => (
								<div
									key={`${index}`}
									className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]"
								>
									<form.AppField name={`avatars[${index}]`}>
										{(field) => (
											<field.AssetField label={`Avatar ${index + 1}`} />
										)}
									</form.AppField>
									<div className="flex items-end gap-2">
										<Button
											disabled={index === 0}
											onClick={() =>
												avatarsField.swapValues(index, index - 1)
											}
										>
											<span className="icon-[lucide--arrow-up] size-4" />
										</Button>
										<Button
											disabled={index === avatarsField.state.value.length - 1}
											onClick={() =>
												avatarsField.swapValues(index, index + 1)
											}
										>
											<span className="icon-[lucide--arrow-down] size-4" />
										</Button>
										<Button onClick={() => avatarsField.removeValue(index)}>
											Remove
										</Button>
									</div>
								</div>
							))}
							{avatarsField.state.value.length >=
							EditorProjectAvatarKeys.length ? null : (
								<Button
									className="justify-self-start"
									onClick={() => avatarsField.pushValue("")}
								>
									Add avatar
								</Button>
							)}
							{avatarsField.state.value.length === 0 ? (
								<p className="text-sm text-muted">No default avatars configured.</p>
							) : null}
						</div>
					)}
				</form.AppField>
			</EditorFormSection>
		</div>
	);
};

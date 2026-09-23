import { ImagePlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EditorResourceThumbnail } from "~/authoring-form/ui/EditorResourceThumbnail";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { ProjectAvatarKeys } from "~/project-authoring/schema/ProjectFormSchema";
import { useProjectFormSession } from "~/project-authoring/ui/ProjectFormContext";
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { ItemSpotlight } from "~/ui/ui/ItemSpotlight";

type ProjectAvatarSlot = (typeof ProjectAvatarKeys)[number];

/** Edits eight stable About image roles through one project Image picker. */
export const ProjectImagesSection = ({
	initialAvatarIndex,
}: {
	readonly initialAvatarIndex?: number;
}) => {
	const translator = useTranslator();
	const { form, project } = useProjectFormSession();
	const [pickerSlot, setPickerSlotFn] = useState<ProjectAvatarSlot>();
	const avatarGridRef = useRef<HTMLDivElement>(null);
	const imageResources = useMemo(
		() => project.resources.filter((resource) => resource.type === "image"),
		[
			project.resources,
		],
	);
	useEffect(() => {
		if (initialAvatarIndex === undefined) return;
		const slot = ProjectAvatarKeys[initialAvatarIndex];
		if (slot === undefined) return;
		avatarGridRef.current
			?.querySelector<HTMLButtonElement>(
				`[data-ui="EditorProjectAvatarSelect"][data-avatar-slot="${slot}"]`,
			)
			?.focus();
	}, [
		initialAvatarIndex,
	]);
	return (
		<div className="grid gap-6">
			<EditorFormSection
				title={translator.textFn("Hero image")}
				description={<Mx label="Project hero image help" />}
			>
				<EditorFormCard>
					<form.AppField name="hero">
						{(field) => (
							<field.ResourceField
								emptyLabel={translator.textFn("No images match this search.")}
								label={translator.textFn("Hero image")}
								resourceType="image"
							/>
						)}
					</form.AppField>
				</EditorFormCard>
			</EditorFormSection>
			<EditorFormSection
				title={translator.textFn("About avatars")}
				description={<Mx label="Project About avatars help" />}
			>
				<EditorFormCard>
					<div
						className="grid grid-cols-4 gap-3"
						data-ui="EditorProjectAvatarGrid"
						ref={avatarGridRef}
					>
						{ProjectAvatarKeys.map((slot) => (
							<form.AppField
								key={slot}
								name={`avatars.${slot}`}
							>
								{(field) => (
									<div
										className="grid min-w-0 gap-2 rounded-xl border border-line bg-surface/60 p-3"
										data-ui="EditorProjectAvatarSlot"
										data-avatar-slot={slot}
									>
										<button
											className="grid min-h-36 min-w-0 place-items-center gap-2 rounded-lg border border-control-border bg-canvas/50 p-2 text-foreground hover:border-accent"
											data-ui="EditorProjectAvatarSelect"
											data-avatar-slot={slot}
											onClick={() => setPickerSlotFn(slot)}
											type="button"
										>
											{field.state.value === "" ? (
												<ImagePlus className="size-8 text-muted" />
											) : (
												<EditorResourceThumbnail
													resourceUid={field.state.value}
													size="lg"
												/>
											)}
											<span className="font-mono text-sm font-semibold">
												{slot}
											</span>
											<span className="max-w-full truncate text-xs text-muted">
												{field.state.value ||
													translator.textFn("No image selected")}
											</span>
										</button>
										{field.state.value === "" ? null : (
											<button
												className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-raised hover:text-foreground"
												data-ui="EditorProjectAvatarClear"
												data-avatar-slot={slot}
												onClick={() => field.handleChange("")}
												type="button"
											>
												<X className="size-3" />
												{translator.textFn("Clear")}
											</button>
										)}
									</div>
								)}
							</form.AppField>
						))}
					</div>
				</EditorFormCard>
			</EditorFormSection>
			{pickerSlot === undefined ? null : (
				<ItemSpotlight
					dataUi="EditorProjectAvatarPicker"
					emptyMessage={translator.textFn("No images match this search.")}
					onCloseFn={() => setPickerSlotFn(undefined)}
					onSelectItemFn={(resourceUid) => {
						if (!imageResources.some((resource) => resource.uid === resourceUid))
							return;
						form.setFieldValue(`avatars.${pickerSlot}`, resourceUid);
						setPickerSlotFn(undefined);
					}}
					options={imageResources.map((resource) => ({
						artwork: (
							<EditorResourceThumbnail
								resourceUid={resource.uid}
								size="md"
							/>
						),
						itemUid: resource.uid,
						label: resource.title,
						secondary: resource.uid,
						terms: [
							resource.title,
							resource.uid,
						],
					}))}
					placement="viewport"
					placeholder={translator.textFn("Search images...")}
				/>
			)}
		</div>
	);
};

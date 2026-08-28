import { GalleryHorizontalEnd, Layers2, Trash2 } from "lucide-react";

import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { Button } from "~/ui/button/Button";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { withFieldGroup } from "~/ui/form/EditorForm";

const defaultArtwork: EditorItem["asset"] = {
	default: [
		"",
	],
	sources: [],
};

/** Owns the complete artwork subtree through TanStack's registered field-group API. */
export const EditorItemArtworkFields = withFieldGroup({
	defaultValues: defaultArtwork,
	props: {
		onSelectedProgressIndexChange: undefined as ((index: number) => void) | undefined,
		selectedProgressIndex: undefined as number | undefined,
	},
	render: ({ group, onSelectedProgressIndexChange, selectedProgressIndex }) => (
		<>
			<EditorFormSectionDivider
				description="The default visual composition shown before any runtime progress artwork applies."
				title="Default artwork"
				variant="secondary"
			/>
			<group.AppField name="default[0]">
				{(field) => <field.AssetField label="Base asset" />}
			</group.AppField>
			<group.Subscribe selector={(state) => state.values.default}>
				{(assets) =>
					assets[1] === undefined ? (
						<EditorCapabilityStatus
							actionLabel="Enable composite artwork"
							description="Composite artwork overlays a second asset on the base image, using the same two-layer presentation wherever this item is rendered."
							icon={Layers2}
							onEnable={() =>
								group.setFieldValue("default", [
									assets[0],
									"",
								])
							}
							title="Composite artwork is disabled"
						/>
					) : (
						<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
							<group.AppField name="default[1]">
								{(field) => <field.AssetField label="Overlay asset" />}
							</group.AppField>
							<Button
								className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
								title="Remove composite layer"
								onClick={() =>
									group.setFieldValue("default", [
										assets[0],
									])
								}
							>
								<Trash2 className="size-4" />
							</Button>
						</div>
					)
				}
			</group.Subscribe>
			<group.AppField
				name="sources"
				mode="array"
			>
				{(sourcesField) => {
					const sources = sourcesField.state.value ?? [];
					return (
						<div className="grid gap-3">
							<EditorFormSectionDivider
								description="Ordered visual states shown as the item advances through runtime progress."
								title="Progress artwork"
								variant="secondary"
							/>
							{sources.length === 0 ? (
								<EditorCapabilityStatus
									actionLabel="Enable progress artwork"
									description="Progress artwork adds ordered visual states after the default composition so the item can change appearance as its runtime state advances."
									icon={GalleryHorizontalEnd}
									onEnable={() => sourcesField.pushValue("")}
									title="Progress artwork is disabled"
								/>
							) : (
								<EditorCollectionSelector
									addLabel="Add progress asset"
									count={sources.length}
									itemLabel={(index) =>
										sources[index] || `Progress asset ${index + 1}`
									}
									label="Progress assets"
									onAdd={() => sourcesField.pushValue("")}
									onRemove={(index) =>
										sources.length === 1
											? group.setFieldValue("sources", undefined)
											: sourcesField.removeValue(index)
									}
									onSelectedIndexChange={onSelectedProgressIndexChange}
									removeLabel="Remove progress asset"
									selectedIndex={selectedProgressIndex ?? 0}
								>
									{(index) => (
										<div className="grid gap-2">
											<group.AppField name={`sources[${index}]`}>
												{(field) => <field.AssetField label="Asset" />}
											</group.AppField>
										</div>
									)}
								</EditorCollectionSelector>
							)}
						</div>
					);
				}}
			</group.AppField>
		</>
	),
});

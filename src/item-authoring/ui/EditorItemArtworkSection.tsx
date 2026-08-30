import { GalleryHorizontalEnd, Layers2, Trash2 } from "lucide-react";
import { useState } from "react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { Button } from "~/ui/button/Button";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormCard } from "~/ui/form/EditorFormCard";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import { withFieldGroup } from "~/authoring-form/ui/EditorForm";
import { EditorItemArtworkTimeline } from "~/item-authoring/ui/EditorItemArtworkTimeline";
import { useEditorItemFormSession } from "~/item-authoring/ui/EditorItemFormContext";

const defaultArtwork: ItemSchema.Type["asset"] = {
	default: [
		"",
	],
	sources: [],
};

const EditorItemArtworkFields = withFieldGroup({
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

const EditorItemArtworkPreview = ({
	asset,
	onSelectProgress,
	selectedProgressIndex,
}: {
	readonly asset: ItemSchema.Type["asset"];
	readonly onSelectProgress: (index: number) => void;
	readonly selectedProgressIndex: number;
}) => (
	<EditorFormCard>
		<header className="flex items-center gap-1">
			<h2 className="text-base font-semibold">Artwork progression</h2>
			<EditorInfoTooltip content="The default composition starts at 0%. Progress assets replace the complete composition at the evenly distributed thresholds shown below, matching the runtime engine." />
		</header>
		<EditorItemArtworkTimeline
			asset={asset}
			onSelectProgress={onSelectProgress}
			selectedProgressIndex={selectedProgressIndex}
		/>
	</EditorFormCard>
);

export const EditorItemArtworkSection = () => {
	const { form } = useEditorItemFormSession();
	const [selectedProgressIndex, setSelectedProgressIndex] = useState(0);
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormCard>
				<EditorItemArtworkFields
					form={form}
					fields="asset"
					onSelectedProgressIndexChange={setSelectedProgressIndex}
					selectedProgressIndex={selectedProgressIndex}
				/>
			</EditorFormCard>
			<form.Subscribe selector={(state) => state.values.asset}>
				{(asset) => (
					<EditorItemArtworkPreview
						asset={asset}
						onSelectProgress={setSelectedProgressIndex}
						selectedProgressIndex={selectedProgressIndex}
					/>
				)}
			</form.Subscribe>
		</div>
	);
};

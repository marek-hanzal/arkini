import { GalleryHorizontalEnd, Layers2, Trash2 } from "lucide-react";
import { useState } from "react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { Button } from "~/ui/ui/Button";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import { withFieldGroupFn } from "~/authoring-form/ui/EditorForm";
import { ArtworkTimeline } from "~/item-authoring/ui/ArtworkTimeline";
import { useFormSession } from "~/item-authoring/ui/FormContext";

const defaultArtwork: ItemSchema.Type["asset"] = {
	default: [
		"",
	],
	sources: [],
};

const ArtworkFields = withFieldGroupFn({
	defaultValues: defaultArtwork,
	props: {
		onSelectedProgressIndexChangeFn: undefined as ((index: number) => void) | undefined,
		selectedProgressIndex: undefined as number | undefined,
	},
	render: ({ group, onSelectedProgressIndexChangeFn, selectedProgressIndex }) => (
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
							onEnableFn={() =>
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
									onEnableFn={() => sourcesField.pushValue("")}
									title="Progress artwork is disabled"
								/>
							) : (
								<EditorCollectionSelector
									addLabel="Add progress asset"
									count={sources.length}
									itemLabelFn={(index) =>
										sources[index] || `Progress asset ${index + 1}`
									}
									label="Progress assets"
									onAddFn={() => sourcesField.pushValue("")}
									onRemoveFn={(index) =>
										sources.length === 1
											? group.setFieldValue("sources", undefined)
											: sourcesField.removeValue(index)
									}
									onSelectedIndexChangeFn={onSelectedProgressIndexChangeFn}
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

const ArtworkPreview = ({
	asset,
	onSelectProgressFn,
	selectedProgressIndex,
}: {
	readonly asset: ItemSchema.Type["asset"];
	readonly onSelectProgressFn: (index: number) => void;
	readonly selectedProgressIndex: number;
}) => (
	<EditorFormCard>
		<header className="flex items-center gap-1">
			<h2 className="text-base font-semibold">Artwork progression</h2>
			<EditorInfoTooltip content="The default composition starts at 0%. Progress assets replace the complete composition at the evenly distributed thresholds shown below, matching the runtime engine." />
		</header>
		<ArtworkTimeline
			asset={asset}
			onSelectProgressFn={onSelectProgressFn}
			selectedProgressIndex={selectedProgressIndex}
		/>
	</EditorFormCard>
);

export const ArtworkSection = () => {
	const { form } = useFormSession();
	const [selectedProgressIndex, setSelectedProgressIndexFn] = useState(0);
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormCard>
				<ArtworkFields
					form={form}
					fields="asset"
					onSelectedProgressIndexChangeFn={setSelectedProgressIndexFn}
					selectedProgressIndex={selectedProgressIndex}
				/>
			</EditorFormCard>
			<form.Subscribe selector={(state) => state.values.asset}>
				{(asset) => (
					<ArtworkPreview
						asset={asset}
						onSelectProgressFn={setSelectedProgressIndexFn}
						selectedProgressIndex={selectedProgressIndex}
					/>
				)}
			</form.Subscribe>
		</div>
	);
};

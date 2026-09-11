import { Trash2 } from "lucide-react";
import { useState } from "react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { Button } from "~/ui/ui/Button";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import { EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
import { readEditorFieldErrorFn } from "~/editor-control/fn/readEditorFieldErrorFn";
import { withFieldGroupFn } from "~/authoring-form/ui/EditorForm";
import { ArtworkTimeline } from "~/item-authoring/ui/ArtworkTimeline";
import { ArtworkTilePreview } from "~/item-authoring/ui/ArtworkTilePreview";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { type FormValues, readCanonicalItemArtworkFn } from "~/item-authoring/schema/FormSchema";

const defaultArtwork: FormValues["asset"] = {
	scale: 0.8,
	default: [
		"",
		"",
	],
	sources: [
		"",
	],
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
			<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
				<group.AppField name="default[1]">
					{(field) => (
						<field.AssetField
							label="Overlay asset"
							optional
						/>
					)}
				</group.AppField>
				<Button
					className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
					title="Clear overlay asset"
					onClick={() => group.setFieldValue("default[1]", "")}
				>
					<Trash2 className="size-4" />
				</Button>
			</div>
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
										? group.setFieldValue("sources", [
												"",
											])
										: sourcesField.removeValue(index)
								}
								onSelectedIndexChangeFn={onSelectedProgressIndexChangeFn}
								removeLabel="Remove progress asset"
								selectedIndex={selectedProgressIndex ?? 0}
							>
								{(index) => (
									<div className="grid gap-2">
										<group.AppField name={`sources[${index}]`}>
											{(field) => (
												<field.AssetField
													label="Asset"
													optional
												/>
											)}
										</group.AppField>
									</div>
								)}
							</EditorCollectionSelector>
						</div>
					);
				}}
			</group.AppField>
			<div className="max-w-48">
				<group.AppField name="scale">
					{(field) => (
						<EditorNumberControl
							label="Base tile scale"
							description="Ratio from 0.25 to 1. 0.8 is 80%; 1 fills the tile at 100%."
							error={readEditorFieldErrorFn(field.state.meta.errors)}
							min={0.25}
							max={1}
							step={0.01}
							name={field.name}
							value={field.state.value}
							onBlurFn={field.handleBlur}
							onChangeFn={field.handleChange}
						/>
					)}
				</group.AppField>
			</div>
			<p className="text-sm text-muted">
				Scale changes artwork only. Occupied cells, storage, interaction reach and image
				resolution stay the same. Transparent padding inside the PNG remains visible.
			</p>
		</>
	),
});

const ArtworkPreview = ({
	asset,
	itemType,
	onSelectProgressFn,
	selectedProgressIndex,
}: {
	readonly asset: ItemSchema.Type["asset"];
	readonly itemType: ItemSchema.Type["type"];
	readonly onSelectProgressFn: (index: number) => void;
	readonly selectedProgressIndex: number;
}) => (
	<EditorFormCard>
		<header
			className="flex items-center gap-1"
			data-ui="EditorItemArtworkProgression"
		>
			<h2 className="text-base font-semibold">Artwork progression</h2>
			<EditorInfoTooltip content="The default composition starts at 0%. Progress assets replace the complete composition at the evenly distributed thresholds shown below, matching the runtime engine." />
		</header>
		<ArtworkTimeline
			asset={asset}
			itemType={itemType}
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
				{(asset) => {
					const canonicalAsset = readCanonicalItemArtworkFn(asset);
					return (
						<>
							<EditorFormCard>
								<h2 className="text-base font-semibold">Tile preview</h2>
								<ArtworkTilePreview
									resourceIds={canonicalAsset.default}
									scale={canonicalAsset.scale}
								/>
								<p className="text-sm text-muted">
									The frame marks the complete tile. Scale 1 fills it with the
									artwork canvas.
								</p>
							</EditorFormCard>
							{canonicalAsset.sources === undefined ? null : (
								<ArtworkPreview
									asset={canonicalAsset}
									itemType={form.state.values.type}
									onSelectProgressFn={setSelectedProgressIndexFn}
									selectedProgressIndex={selectedProgressIndex}
								/>
							)}
						</>
					);
				}}
			</form.Subscribe>
		</div>
	);
};

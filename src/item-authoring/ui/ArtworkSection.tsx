import { Trash2 } from "lucide-react";

import { Button } from "~/ui/ui/Button";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
import { readEditorFieldErrorFn } from "~/editor-control/fn/readEditorFieldErrorFn";
import { withFieldGroupFn } from "~/authoring-form/ui/EditorForm";
import { ArtworkTilePreview } from "~/item-authoring/ui/ArtworkTilePreview";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { type FormValues, readCanonicalItemArtworkFn } from "~/item-authoring/schema/FormSchema";

const defaultArtwork: FormValues["asset"] = {
	scale: 1,
	default: [
		"",
		"",
	],
};

const ArtworkFields = withFieldGroupFn({
	defaultValues: defaultArtwork,
	render: ({ group }) => (
		<>
			<EditorFormSectionDivider
				description="The visual composition shown on the item tile."
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
			<div className="max-w-48">
				<group.AppField name="scale">
					{(field) => (
						<EditorNumberControl
							label="Base tile scale"
							description="Ratio from 0.25 to 1. The default 1 fills the tile at 100%."
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

export const ArtworkSection = () => {
	const { form } = useFormSession();
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormCard>
				<ArtworkFields
					form={form}
					fields="asset"
				/>
			</EditorFormCard>
			<form.Subscribe selector={(state) => state.values.asset}>
				{(asset) => {
					const canonicalAsset = readCanonicalItemArtworkFn(asset);
					return (
						<EditorFormCard>
							<h2 className="text-base font-semibold">Tile preview</h2>
							<ArtworkTilePreview
								resourceIds={canonicalAsset.default}
								scale={canonicalAsset.scale}
							/>
							<p className="text-sm text-muted">
								The frame marks the complete tile. Scale 1 fills it with the artwork
								canvas.
							</p>
						</EditorFormCard>
					);
				}}
			</form.Subscribe>
		</div>
	);
};

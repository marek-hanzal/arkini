import { Trash2 } from "lucide-react";

import { LinkButton } from "~/ui/ui/LinkButton";
import { useTranslator } from "~/translation/ui/useTranslator";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
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
	render: ({ group }) => {
		const translator = useTranslator();
		return (
			<>
				<group.AppField name="default[0]">
					{(field) => <field.AssetField label={translator.textFn("Base asset")} />}
				</group.AppField>
				<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
					<group.AppField name="default[1]">
						{(field) => (
							<field.AssetField
								label={translator.textFn("Overlay asset")}
								optional
							/>
						)}
					</group.AppField>
					<LinkButton
						className="flex h-[var(--ak-control-min-height)] shrink-0 items-center"
						title={translator.textFn("Clear overlay asset")}
						onClick={() => group.setFieldValue("default[1]", "")}
					>
						<Trash2 className="size-4" />
					</LinkButton>
				</div>
				<div className="max-w-48">
					<group.AppField name="scale">
						{(field) => (
							<EditorNumberControl
								label={translator.textFn("Base tile scale")}
								description={translator.textFn(
									"Ratio from 0.25 to 1. The default 1 fills the tile at 100%.",
								)}
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
			</>
		);
	},
});

export const ArtworkSection = () => {
	const { form } = useFormSession();
	const translator = useTranslator();
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
							<EditorFormSectionDivider
								title={translator.textFn("Tile preview")}
								description={translator.textFn(
									"The frame marks the complete tile. Scale 1 fills it with the artwork canvas.",
								)}
								variant="secondary"
							/>
							<ArtworkTilePreview
								resourceIds={canonicalAsset.default}
								scale={canonicalAsset.scale}
							/>
						</EditorFormCard>
					);
				}}
			</form.Subscribe>
		</div>
	);
};

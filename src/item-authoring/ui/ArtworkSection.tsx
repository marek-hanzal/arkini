import { ArtworkTilePreview } from "~/item-authoring/ui/ArtworkTilePreview";
import { Trash2 } from "lucide-react";

import { EditorIconButton } from "~/editor-control/ui/EditorIconButton";
import { useTranslator } from "~/translation/ui/useTranslator";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
import { readEditorFieldErrorFn } from "~/editor-control/fn/readEditorFieldErrorFn";
import { withFieldGroupFn } from "~/authoring-form/ui/EditorForm";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import type { FormValues } from "~/item-authoring/schema/FormSchema";
import { Mx } from "~/translation/ui/Mx";

const defaultArtwork: FormValues["artwork"] = {
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
				<EditorFormSectionDivider title={translator.textFn("Artwork")} />
				<div className="grid grid-cols-[minmax(0,1fr)_12rem] items-start gap-4">
					<group.AppField name="default[0]">
						{(field) => (
							<field.ResourceField
								emptyLabel={translator.textFn("No artwork matches this search.")}
								label={translator.textFn("Base artwork")}
								resourceType="artwork"
							/>
						)}
					</group.AppField>
					<group.AppField name="scale">
						{(field) => (
							<EditorNumberControl
								label={translator.textFn("Base tile scale")}
								description={<Mx label="Base tile scale help" />}
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
				<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
					<group.AppField name="default[1]">
						{(field) => (
							<field.ResourceField
								emptyLabel={translator.textFn("No artwork matches this search.")}
								label={translator.textFn("Overlay artwork")}
								optional
								resourceType="artwork"
							/>
						)}
					</group.AppField>
					<EditorIconButton onClick={() => group.setFieldValue("default[1]", "")}>
						<Trash2 className="size-4" />
					</EditorIconButton>
				</div>
			</>
		);
	},
});

export const ArtworkSection = () => {
	const { form } = useFormSession();
	return (
		<section
			className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3"
			data-ui="EditorArtworkForm"
		>
			<EditorFormCard>
				<ArtworkFields
					form={form}
					fields="artwork"
				/>
			</EditorFormCard>
			<div
				className="grid min-h-0 min-w-0 place-items-center [container-type:size]"
				data-ui="EditorArtworkPreviewArea"
			>
				<form.Subscribe selector={(state) => state.values.artwork}>
					{(artwork) =>
						artwork.default[0] ? (
							<ArtworkTilePreview
								className="size-[min(80cqh,100cqw)] rounded-2xl border-2 border-accent"
								resourceIds={
									artwork.default[1]
										? [
												artwork.default[0],
												artwork.default[1],
											]
										: [
												artwork.default[0],
											]
								}
								scale={artwork.scale}
							/>
						) : null
					}
				</form.Subscribe>
			</div>
		</section>
	);
};

import { Tooltip } from "~/ui/ui/Tooltip";
import { useState } from "react";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Check } from "lucide-react";
import { LinkButton } from "~/ui/ui/LinkButton";
import { EditorAssetReferenceControl } from "~/authoring-form/ui/AssetAutocompleteField";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useTilePaintingSession } from "~/tile-painting/ui/useTilePaintingSession";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

/** Admits an image exclusively through the existing project asset picker. */
export const TilePaintingImagePicker = ({
	label,
	description,
	compact = false,
	applyFn,
}: {
	readonly label: string;
	readonly description?: string;
	readonly compact?: boolean;
	readonly applyFn: (
		document: TilePaintingDocumentSchema.Type,
		imageId: string,
	) => TilePaintingDocumentSchema.Type;
}) => {
	const project = useEditorProject();
	const session = useTilePaintingSession();
	const [resourceId, setResourceIdFn] = useState("");
	return (
		<fieldset
			disabled={session.busy}
			className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-end gap-3 data-[ui-compact=true]:w-[32rem]"
			{...readDataUiFn({
				dataUi: "TilePaintingImagePicker",
				state: {
					compact,
				},
			})}
		>
			<div className="min-w-0">
				<EditorAssetReferenceControl
					label={label}
					description={description}
					labelVisible={!compact}
					value={resourceId}
					onChangeFn={setResourceIdFn}
				/>
			</div>
			<Tooltip
				content="Use selected asset"
				contentClassName="z-50"
			>
				<LinkButton
					className="inline-flex min-h-[var(--ak-control-min-height)] shrink-0 items-center justify-center px-1"
					disabled={session.busy || resourceId === ""}
					onClick={async () => {
						const source = project.resources.find(
							(resource) => resource.id === resourceId,
						);
						if (source !== undefined && (await session.addImageFn(source, applyFn)))
							setResourceIdFn("");
					}}
				>
					<Check className="size-4" />
				</LinkButton>
			</Tooltip>
		</fieldset>
	);
};

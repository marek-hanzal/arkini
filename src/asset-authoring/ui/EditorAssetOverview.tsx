import { useTranslator } from "~/translation/ui/useTranslator";
import { useState } from "react";

import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { formatByteSizeFn } from "~/ui/fn/formatByteSizeFn";
import { Fact, FactList } from "~/ui/ui/FactList";
import { useEditorAssetById } from "~/asset-authoring/ui/useEditorAssetById";
import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";

export const EditorAssetOverview = ({ resourceId }: { readonly resourceId: string }) => {
	const translator = useTranslator();
	const resource = useEditorAssetById(resourceId);
	const url = useResourceUrl(resourceId);
	const [dimensions, setDimensionsFn] = useState<{
		readonly height: number;
		readonly url: string;
		readonly width: number;
	}>();
	if (resource === undefined) return null;
	const currentDimensions = dimensions?.url === url ? dimensions : undefined;
	return (
		<section
			className="mx-auto flex h-full min-h-0 w-3/4 min-w-0 flex-col gap-3 overflow-y-auto p-3"
			data-ui="EditorAssetOverview"
		>
			<div className="grid shrink-0 gap-3 lg:grid-cols-2">
				<EditorRootCard dataUi="EditorAssetIdentityCard">
					<FactList>
						<Fact
							label={translator.textFn("Resource ID")}
							mono
							value={resource.id}
						/>
						<Fact
							label={translator.textFn("Package status")}
							value={translator.textFn("Included in current project")}
						/>
					</FactList>
				</EditorRootCard>
				<EditorRootCard dataUi="EditorAssetImageDetailsCard">
					<FactList columns={3}>
						<Fact
							label={translator.textFn("Dimensions")}
							value={
								currentDimensions === undefined
									? translator.textFn("Reading image…")
									: `${currentDimensions.width} × ${currentDimensions.height} px`
							}
						/>
						<Fact
							label={translator.textFn("MIME type")}
							mono
							value={resource.mime}
						/>
						<Fact
							label={translator.textFn("Byte size")}
							value={formatByteSizeFn(resource.size)}
						/>
					</FactList>
				</EditorRootCard>
			</div>
			<div
				className="grid min-h-48 min-w-0 flex-1 place-items-center [container-type:size]"
				data-ui="EditorAssetPreviewArea"
			>
				{url === undefined ? (
					<p className="text-sm text-muted">
						{translator.textFn("Preparing asset preview…")}
					</p>
				) : (
					<div className="grid size-[min(80cqh,100cqw)] place-items-center overflow-hidden rounded-2xl border-2 border-accent bg-canvas/70">
						<img
							src={url}
							alt={`${resource.id} preview`}
							className="size-full object-contain"
							draggable={false}
							onLoad={(event) =>
								setDimensionsFn({
									height: event.currentTarget.naturalHeight,
									url,
									width: event.currentTarget.naturalWidth,
								})
							}
						/>
					</div>
				)}
			</div>
		</section>
	);
};

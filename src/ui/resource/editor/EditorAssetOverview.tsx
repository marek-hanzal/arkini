import { useState } from "react";

import { useEditorAssetById } from "~/ui/resource/editor/useEditorAssetById";
import { useEditorResourceUrl } from "~/ui/resource/editor/useEditorResourceUrl";

export const EditorAssetOverview = ({ resourceId }: { readonly resourceId: string }) => {
	const resource = useEditorAssetById(resourceId);
	const url = useEditorResourceUrl(resourceId);
	const [dimensions, setDimensions] = useState<{
		readonly height: number;
		readonly url: string;
		readonly width: number;
	}>();
	if (resource === undefined) return null;
	const currentDimensions = dimensions?.url === url ? dimensions : undefined;
	return (
		<section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)]">
			<div className="grid min-h-72 place-items-center overflow-hidden rounded-xl border border-line bg-canvas/70 p-5">
				{url === undefined ? (
					<p className="text-sm text-muted">Preparing asset preview…</p>
				) : (
					<img
						src={url}
						alt={`${resource.id} preview`}
						className="max-h-[32rem] max-w-full object-contain"
						draggable={false}
						onLoad={(event) =>
							setDimensions({
								height: event.currentTarget.naturalHeight,
								url,
								width: event.currentTarget.naturalWidth,
							})
						}
					/>
				)}
			</div>
			<dl className="grid content-start gap-4 rounded-xl border border-line bg-surface/70 p-5">
				<div>
					<dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
						Resource ID
					</dt>
					<dd className="mt-1 break-all text-sm text-foreground">{resource.id}</dd>
				</div>
				<div>
					<dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
						Type
					</dt>
					<dd className="mt-1 text-sm text-foreground">PNG image</dd>
				</div>
				<div>
					<dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
						Dimensions
					</dt>
					<dd className="mt-1 text-sm text-foreground">
						{currentDimensions === undefined
							? "Reading image…"
							: `${currentDimensions.width} × ${currentDimensions.height} px`}
					</dd>
				</div>
			</dl>
		</section>
	);
};

import type { FC } from "react";

import { readResourceIdFromAssetId } from "~/v1/asset/readResourceIdFromAssetId";
import type { AssetSchema } from "~/v1/item/schema/AssetSchema";
import { useDevGamePack } from "../../../pack/hook/useDevGamePack";
import { CodePill } from "./DetailPrimitives";

export namespace ItemAssetPanel {
	export interface Props {
		asset: AssetSchema.Type;
	}
}

export const ItemAssetPanel: FC<ItemAssetPanel.Props> = ({ asset }) => {
	const { resourceUrlById } = useDevGamePack();
	const assets = [
		...asset.source.map((assetId) => ({
			assetId,
			kind: "source" as const,
		})),
		...(asset.composite
			? [
					{
						assetId: asset.composite,
						kind: "composite" as const,
					},
				]
			: []),
	];

	return (
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			{assets.map(({ assetId, kind }) => {
				const resourceId = readResourceIdFromAssetId(assetId);
				const url = resourceUrlById.get(resourceId);

				return (
					<div
						key={`${kind}-${assetId}`}
						className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/45 p-3"
					>
						<div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
							{url ? (
								<img
									src={url}
									alt=""
									className="size-full object-contain p-1"
								/>
							) : (
								<span className="text-xs text-slate-600">missing</span>
							)}
						</div>
						<div className="min-w-0">
							<p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
								{kind}
							</p>
							<p className="mt-1 break-all font-mono text-xs text-slate-300">
								{assetId}
							</p>
							<div className="mt-2">
								<CodePill tone={url ? "emerald" : "rose"}>{resourceId}</CodePill>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
};

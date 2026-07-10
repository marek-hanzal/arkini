import prettyBytes from "pretty-bytes";
import type { FC } from "react";

import { useDevGamePack } from "../hook/useDevGamePack";

export const PackSummary: FC = () => {
	const { config, resources, fileName, fileSize, reset } = useDevGamePack();
	if (!config || !fileName || fileSize === null) {
		return null;
	}

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-emerald-900/60 bg-emerald-950/25 p-5 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<div className="flex flex-wrap items-center gap-2">
					<span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
						Validated
					</span>
					<span className="font-mono text-sm text-slate-300">{fileName}</span>
				</div>
				<p className="mt-2 text-sm text-slate-400">
					{Object.keys(config.items).length} items ·{" "}
					{Object.keys(config.categories).length} categories · {resources.length}{" "}
					resources · {prettyBytes(fileSize)}
				</p>
			</div>
			<button
				type="button"
				className="self-start rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white sm:self-auto"
				onClick={reset}
			>
				Unload
			</button>
		</div>
	);
};

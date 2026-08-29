import { GitCompareArrows } from "lucide-react";

import type { EditorProjectDescriptor } from "~/editor/EditorProjectDescriptor";
import type { EditorProjectCompatibility } from "~/editor/version/EditorProjectCompatibility";
import { bumpArkpackVersionFn } from "~/editor/version/fn/bumpArkpackVersionFn";

export const EditorCompatibilityNotice = ({
	compatibility,
	version,
}: {
	readonly compatibility: EditorProjectCompatibility | undefined;
	readonly version: EditorProjectDescriptor["version"];
}) => {
	const result = compatibility?.result ?? "noop";
	const next = bumpArkpackVersionFn(version, result);
	const presentation =
		result === "major"
			? {
					className: "border-danger bg-danger/5",
					title: "Breaking gameplay change",
				}
			: result === "minor"
				? {
						className: "border-success bg-success/5",
						title: "Save-compatible change",
					}
				: {
						className: "border-line-strong bg-surface-raised/45",
						title: "No gameplay change",
					};
	return (
		<aside
			className={`flex items-center gap-2 rounded-xl border-l-2 px-4 py-3 text-sm ${presentation.className}`}
			data-result={result}
			data-ui="EditorCompatibilityNotice"
		>
			<GitCompareArrows className="size-4 shrink-0" />
			<p className="min-w-0 truncate font-semibold">
				{presentation.title} · v{version}
				{result === "noop" ? null : ` → v${next}`}
			</p>
		</aside>
	);
};

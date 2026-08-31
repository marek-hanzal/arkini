import { GitCompareArrows } from "lucide-react";

import type { ProjectDescriptor } from "~/project-authoring/schema/ProjectDescriptorSchema";
import type { ProjectCompatibility } from "~/project-version/type/ProjectCompatibility";
import { bumpArkpackVersionFn } from "~/project-version/fn/bumpArkpackVersionFn";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

export const ProjectCompatibilityNotice = ({
	compatibility,
	version,
}: {
	readonly compatibility: ProjectCompatibility | undefined;
	readonly version: ProjectDescriptor["version"];
}) => {
	const result = compatibility?.result ?? "noop";
	const next = bumpArkpackVersionFn(version, result);
	const presentation =
		result === "major"
			? {
					title: "Breaking gameplay change",
				}
			: result === "minor"
				? {
						title: "Save-compatible change",
					}
				: {
						title: "No gameplay change",
					};
	return (
		<aside
			className="flex items-center gap-2 rounded-xl border-l-2 px-4 py-3 text-sm data-[ui-result=major]:border-danger data-[ui-result=major]:bg-danger/5 data-[ui-result=minor]:border-success data-[ui-result=minor]:bg-success/5 data-[ui-result=noop]:border-line-strong data-[ui-result=noop]:bg-surface-raised/45"
			{...readDataUiFn({
				dataUi: "EditorCompatibilityNotice",
				state: {
					result,
				},
			})}
		>
			<GitCompareArrows className="size-4 shrink-0" />
			<p className="min-w-0 truncate font-semibold">
				{presentation.title} · v{version}
				{result === "noop" ? null : ` → v${next}`}
			</p>
		</aside>
	);
};

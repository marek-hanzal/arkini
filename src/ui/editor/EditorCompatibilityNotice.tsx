import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import type { EditorProjectCompatibility } from "~/editor/version/EditorProjectCompatibility";
import { bumpArkpackVersionFx } from "~/editor/version/bumpArkpackVersionFx";

export const EditorCompatibilityNotice = ({
	compatibility,
	version,
}: {
	readonly compatibility: EditorProjectCompatibility | undefined;
	readonly version: EditorProjectDescriptor["version"];
}) => {
	const level = compatibility?.level ?? "none";
	const next = RendererRuntime.runSync(bumpArkpackVersionFx(version, level));
	const presentation =
		level === "major"
			? {
					className: "border-danger bg-danger/5",
					description:
						"Saving this change permanently deletes every saved Board scenario in this project. Existing published game saves remain stored but cannot load this gameplay major.",
					title: "Breaking gameplay change",
				}
			: level === "minor"
				? {
						className: "border-success bg-success/5",
						description:
							"Saved Board scenarios and published game saves remain compatible with this change.",
						title: "Save-compatible change",
					}
				: {
						className: "border-line-strong bg-surface-raised/45",
						description: "The current draft keeps the existing arkpack version.",
						title: "No gameplay change",
					};
	return (
		<aside
			className={`h-28 overflow-y-auto overscroll-contain rounded-xl border-l-2 p-4 text-sm ${presentation.className}`}
			data-level={level}
			data-ui="EditorCompatibilityNotice"
		>
			<p className="font-semibold">
				{presentation.title} · v{version}
				{level === "none" ? null : ` → v${next}`}
			</p>
			<p className="mt-1 text-muted">{presentation.description}</p>
			<ul className="mt-2 grid gap-1 text-xs text-muted">
				{level === "none" ? (
					<li>Edit gameplay configuration to preview save compatibility.</li>
				) : (
					compatibility?.reasons.map((item) => (
						<li key={`${item.code}:${item.path.join(".")}`}>{item.message}</li>
					))
				)}
			</ul>
		</aside>
	);
};

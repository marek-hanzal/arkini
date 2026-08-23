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
	if (compatibility === undefined || compatibility.level === "none") return null;
	const next = RendererRuntime.runSync(bumpArkpackVersionFx(version, compatibility.level));
	const breaking = compatibility.level === "major";
	return (
		<aside
			className={`rounded-xl border-l-2 p-4 text-sm ${breaking ? "border-danger bg-danger/5" : "border-success bg-success/5"}`}
			data-ui="EditorCompatibilityNotice"
		>
			<p className="font-semibold">
				{breaking ? "Breaking gameplay change" : "Save-compatible change"} · v{version} → v
				{next}
			</p>
			<p className="mt-1 text-muted">
				{breaking
					? "Existing saves will start a new game after this change is published."
					: "Existing saves will continue without migration."}
			</p>
			<ul className="mt-2 grid gap-1 text-xs text-muted">
				{compatibility.reasons.map((item) => (
					<li key={`${item.code}:${item.path.join(".")}`}>{item.message}</li>
				))}
			</ul>
		</aside>
	);
};

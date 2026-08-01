import { useEditorAssetById } from "~/ui/resource/editor/useEditorAssetById";

export const EditorAssetTechnical = ({ resourceId }: { readonly resourceId: string }) => {
	const resource = useEditorAssetById(resourceId);
	if (resource === undefined) return null;
	return (
		<dl className="grid gap-4 rounded-xl border border-line bg-surface/70 p-5 sm:grid-cols-2">
			<div>
				<dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
					MIME type
				</dt>
				<dd className="mt-1 text-sm text-foreground">{resource.mime}</dd>
			</div>
			<div>
				<dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
					Byte size
				</dt>
				<dd className="mt-1 text-sm text-foreground">
					{resource.bytes.byteLength.toLocaleString()} bytes
				</dd>
			</div>
			<div>
				<dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
					Project storage
				</dt>
				<dd className="mt-1 text-sm text-foreground">IndexedDB resource record</dd>
			</div>
			<div>
				<dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
					Build inclusion
				</dt>
				<dd className="mt-1 text-sm text-foreground">Validated during Arkpack Build</dd>
			</div>
		</dl>
	);
};

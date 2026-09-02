import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { FolderOutput } from "lucide-react";
import { useCallback } from "react";

import { EditorSourceExportSchema } from "~electron/contract/editor/EditorSourceExportSchema";
import { invokeProjectTransportFx } from "~/project-authoring/fx/invokeProjectTransportFx";
import { LinkButton } from "~/ui/ui/LinkButton";

const exportProjectSourceAtom = Atom.family((projectId: string) =>
	Atom.fn(() =>
		invokeProjectTransportFx({
			callFn: () => window.arkini.editor.exportJsonDirectoryFn(projectId),
			operation: "export-json-directory",
			parseFn: (value) => (value === null ? null : EditorSourceExportSchema.parse(value)),
			requestMessage: "The editor JSON export request failed.",
			responseMessage: "The editor JSON export response is invalid.",
		}),
	).pipe(Atom.setIdleTTL(0)),
);

/** Owns portable project export independently from Editor Build artifact publication. */
export const ProjectSourceExport = ({ projectId }: { readonly projectId: string }) => {
	const exportAtom = exportProjectSourceAtom(projectId);
	const exportResult = useAtomValue(exportAtom);
	const runExportFn = useAtomSet(exportAtom);
	const exportSourceFn = useCallback(
		() => runExportFn(undefined),
		[
			runExportFn,
		],
	);

	return (
		<LinkButton
			className="inline-flex items-center gap-1.5"
			data-ui="EditorProjectExport"
			disabled={exportResult.waiting}
			cursorIntent={exportResult.waiting ? "progress" : undefined}
			onClick={exportSourceFn}
		>
			<FolderOutput className="size-4" />
			Export
		</LinkButton>
	);
};

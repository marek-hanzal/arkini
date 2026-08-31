import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { FolderOutput } from "lucide-react";
import { useCallback, useRef } from "react";

import { EditorSourceExportSchema } from "~electron/contract/editor/EditorSourceExportSchema";
import { invokeProjectTransportFx } from "~/project-authoring/fx/invokeProjectTransportFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { Button, PrimaryButton } from "~/ui/ui/Button";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

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

const openProjectExportAtom = Atom.fn(() =>
	invokeProjectTransportFx({
		callFn: () => window.arkini.editor.openExportDirectoryFn(),
		operation: "open-export-directory",
		parseFn: () => undefined,
		requestMessage: "The Editor project export folder request failed.",
		responseMessage: "The Editor project export folder response is invalid.",
	}),
).pipe(Atom.setIdleTTL(0));

const readErrorMessageFn = (error: unknown) =>
	error === undefined ? undefined : error instanceof Error ? error.message : String(error);

/** Owns portable project export independently from Editor Build artifact publication. */
export const ProjectSourceExport = ({ projectId }: { readonly projectId: string }) => {
	const exportAtom = exportProjectSourceAtom(projectId);
	const exportResult = useAtomValue(exportAtom);
	const runExportFn = useAtomSet(exportAtom);
	const exportError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(exportResult));
	const completedExport =
		AsyncResult.isSuccess(exportResult) && !exportResult.waiting
			? exportResult.value
			: undefined;
	const sourceExportRef = useRef<
		| {
				readonly projectId: string;
				readonly value: EditorSourceExportSchema.Type;
		  }
		| undefined
	>(undefined);
	if (sourceExportRef.current?.projectId !== projectId) sourceExportRef.current = undefined;
	if (completedExport !== undefined && completedExport !== null)
		sourceExportRef.current = {
			projectId,
			value: completedExport,
		};
	const sourceExport = sourceExportRef.current?.value;
	const openResult = useAtomValue(openProjectExportAtom);
	const runOpenFn = useAtomSet(openProjectExportAtom);
	const openError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(openResult));
	const exportSourceFn = useCallback(
		() => runExportFn(undefined),
		[
			runExportFn,
		],
	);
	const openSourceExportFn = useCallback(() => {
		if (sourceExport !== undefined) runOpenFn(undefined);
	}, [
		runOpenFn,
		sourceExport,
	]);
	const summary =
		sourceExport === undefined
			? undefined
			: `Exported revision ${sourceExport.revision}: ${sourceExport.json} JSON files and ${sourceExport.resources} PNG resources to ${sourceExport.root}.`;

	return (
		<article className="rounded-2xl border-l-2 border-line-strong bg-surface-raised/60 p-5">
			<h2 className="text-lg font-semibold">Editor project export</h2>
			<p className="mt-1 text-sm text-muted">
				Copies the complete saved Editor folder, including assets, notes, scenarios, and
				version history. The exported folder can be opened directly by the Editor.
			</p>
			<div className="mt-4 flex flex-wrap gap-3">
				<PrimaryButton
					data-ui="EditorProjectExport"
					disabled={exportResult.waiting}
					cursorIntent={exportResult.waiting ? "progress" : undefined}
					onClick={exportSourceFn}
				>
					<FolderOutput className="mr-2 size-4" />
					Export
				</PrimaryButton>
				{sourceExport === undefined ? null : (
					<Button
						data-ui="EditorProjectOpenExport"
						disabled={openResult.waiting}
						cursorIntent={openResult.waiting ? "progress" : undefined}
						onClick={openSourceExportFn}
					>
						Open folder
					</Button>
				)}
			</div>
			{readErrorMessageFn(exportError) === undefined ? null : (
				<p className="mt-3 text-sm text-danger">{readErrorMessageFn(exportError)}</p>
			)}
			{summary === undefined ? null : (
				<p className="mt-3 break-all text-sm text-success">{summary}</p>
			)}
			{readErrorMessageFn(openError) === undefined ? null : (
				<p className="mt-3 text-sm text-danger">{readErrorMessageFn(openError)}</p>
			)}
		</article>
	);
};

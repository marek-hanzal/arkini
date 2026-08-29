import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { FolderOutput } from "lucide-react";
import { useCallback, useRef } from "react";

import { EditorSourceExportSchema } from "../../../electron/contract/editor/EditorSourceExportSchema";
import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import { invokeEditorProjectTransportFx } from "~/project-authoring/repository/invokeEditorProjectTransportFx";
import { RendererRuntime } from "~/application-runtime/RendererRuntime";
import { Button, PrimaryButton } from "~/ui/button/Button";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";

const exportProjectSourceAtom = Atom.family((projectId: string) =>
	Atom.fn(() =>
		invokeEditorProjectTransportFx({
			call: () => window.arkini.editor.exportJsonDirectory(projectId),
			operation: "export-json-directory",
			parse: (value) => (value === null ? null : EditorSourceExportSchema.parse(value)),
			requestMessage: "The editor JSON export request failed.",
			responseMessage: "The editor JSON export response is invalid.",
		}),
	).pipe(Atom.setIdleTTL(0)),
);

const openProjectExportAtom = Atom.fn(() =>
	invokeEditorProjectTransportFx({
		call: () => window.arkini.editor.openExportDirectory(),
		operation: "open-export-directory",
		parse: () => undefined,
		requestMessage: "The Editor project export folder request failed.",
		responseMessage: "The Editor project export folder response is invalid.",
	}),
).pipe(Atom.setIdleTTL(0));

const readErrorMessageFn = (error: unknown) =>
	error === undefined ? undefined : error instanceof Error ? error.message : String(error);

/** Owns portable project export independently from Editor Build artifact publication. */
export const EditorProjectExport = ({ projectId }: { readonly projectId: string }) => {
	const exportAtom = exportProjectSourceAtom(projectId);
	const exportResult = useAtomValue(exportAtom);
	const runExport = useAtomSet(exportAtom);
	const exportError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(exportResult));
	const completedExport =
		AsyncResult.isSuccess(exportResult) && !exportResult.waiting
			? exportResult.value
			: undefined;
	const sourceExportRef = useRef<
		| {
				readonly projectId: string;
				readonly value: EditorProjectTransport.SourceExport;
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
	const runOpen = useAtomSet(openProjectExportAtom);
	const openError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(openResult));
	const exportSource = useCallback(
		() => runExport(undefined),
		[
			runExport,
		],
	);
	const openSourceExport = useCallback(() => {
		if (sourceExport !== undefined) runOpen(undefined);
	}, [
		runOpen,
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
					onClick={exportSource}
				>
					<FolderOutput className="mr-2 size-4" />
					Export
				</PrimaryButton>
				{sourceExport === undefined ? null : (
					<Button
						data-ui="EditorProjectOpenExport"
						disabled={openResult.waiting}
						cursorIntent={openResult.waiting ? "progress" : undefined}
						onClick={openSourceExport}
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

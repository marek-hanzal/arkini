import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import { EditorArkpackImportDropZone } from "~/ui/arkpack/editor/EditorArkpackImportDropZone";
import { BackButton } from "~/ui/button/BackButton";
import { Button } from "~/ui/button/Button";
import { EditorRecentProjects } from "~/ui/editor/EditorRecentProjects";
import { useEditorWelcomeActions } from "~/ui/editor/useEditorWelcomeActions";

export namespace EditorWelcome {
	export interface Props {
		readonly recentProjects: ReadonlyArray<EditorProjectDescriptor>;
	}
}

/** Starts or reopens one local editor project. */
export const EditorWelcome = ({ recentProjects }: EditorWelcome.Props) => {
	const actions = useEditorWelcomeActions();
	return (
		<div
			className="grid min-h-0 gap-5"
			data-ui="EditorWelcome"
		>
			<header>
				<h1
					id="editor-welcome-title"
					className="text-2xl font-semibold"
				>
					Editor
				</h1>
			</header>

			<section className="grid gap-3 sm:grid-cols-2">
				<EditorArkpackImportDropZone
					blocked={actions.blocked}
					pending={actions.active === "import"}
					onFile={actions.importFile}
				/>
				<Button
					disabled
					cursorIntent="not-allowed"
					className="min-h-44 flex-col gap-3 rounded-2xl"
				>
					<span className="icon-[lucide--file-plus-2] size-9" />
					<span className="text-lg">New arkpack</span>
					<span className="text-xs font-medium opacity-75">Not available yet</span>
				</Button>
			</section>

			{actions.error === undefined ? null : (
				<p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
					{actions.error instanceof Error ? actions.error.message : String(actions.error)}
				</p>
			)}

			<EditorRecentProjects
				blocked={actions.blocked}
				projects={recentProjects}
			/>

			<footer className="flex justify-center">
				<BackButton
					disabled={actions.blocked}
					cursorIntent={actions.active === "exit" ? "progress" : undefined}
					onClick={actions.exit}
				>
					{actions.active === "exit" ? "Returning…" : "Back"}
				</BackButton>
			</footer>
		</div>
	);
};

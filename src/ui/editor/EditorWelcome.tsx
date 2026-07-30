import { Button, PrimaryButton } from "~/ui/button/Button";
import { useEditorWelcomeActions } from "~/ui/editor/useEditorWelcomeActions";

/** Starts a local editor project by expanding an existing arkpack into user data. */
export const EditorWelcome = () => {
	const actions = useEditorWelcomeActions();
	return (
		<div
			className="grid min-h-0 gap-6"
			data-ui="EditorWelcome"
		>
			<header>
				<h1
					id="editor-welcome-title"
					className="text-2xl font-semibold"
				>
					Open an editable arkpack workspace
				</h1>
				<p className="mt-2 text-sm leading-6 text-muted">
					Projects stay in Arkini user data. Import validates the package before any source
					files are published.
				</p>
			</header>

			<section className="grid gap-3 rounded-2xl border border-line bg-surface/80 p-4">
				<label className="grid gap-2 text-sm font-semibold text-foreground">
					Load existing arkpack
					<input
						ref={actions.inputRef}
						type="file"
						accept=".arkpack,application/octet-stream"
						className="block min-w-0 w-full cursor-pointer text-sm text-muted disabled:cursor-progress file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:font-semibold file:text-accent-contrast hover:file:bg-accent-hover disabled:file:cursor-progress"
						disabled={actions.blocked}
						onChange={(event) => void actions.importFile(event.currentTarget.files?.[0])}
					/>
				</label>
				{actions.active === "import" ? (
					<p className="text-sm text-accent">Validating and expanding arkpack…</p>
				) : null}
				<PrimaryButton
					disabled
					cursorIntent="not-allowed"
					className="justify-between"
				>
					<span>New arkpack</span>
					<span className="text-xs font-medium opacity-75">Not available yet</span>
				</PrimaryButton>
			</section>

			{actions.error === undefined ? null : (
				<p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
					{actions.error instanceof Error ? actions.error.message : String(actions.error)}
				</p>
			)}

			<footer className="flex flex-wrap justify-between gap-3">
				<Button
					disabled={actions.blocked}
					cursorIntent={actions.active === "open-directory" ? "progress" : undefined}
					onClick={actions.openRoot}
				>
					{actions.active === "open-directory" ? "Opening folder…" : "Open editor folder"}
				</Button>
				<Button
					disabled={actions.blocked}
					cursorIntent={actions.active === "exit" ? "progress" : undefined}
					onClick={actions.exit}
				>
					{actions.active === "exit" ? "Returning…" : "Return to main menu"}
				</Button>
			</footer>
		</div>
	);
};

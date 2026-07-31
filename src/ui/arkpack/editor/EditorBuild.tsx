import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { useEditorProjectDraft } from "~/bridge/editor/useEditorProjectDraft";
import { PrimaryButton } from "~/ui/button/Button";

/** Shows the canonical project validation result and unavailable package controls. */
export const EditorBuild = () => {
	const project = useEditorProject();
	const staged = useEditorProjectDraft(project.projectId);
	const stagedCount = Object.keys(staged).length;
	const configured = project.config !== undefined;
	const stale = configured && stagedCount > 0;
	return (
		<section
			className="grid h-full min-h-0 content-start gap-[var(--ak-viewport-gap)] overflow-y-auto overscroll-contain"
			aria-labelledby="editor-build-title"
			data-ui="EditorBuild"
		>
			<header>
				<h1
					id="editor-build-title"
					className="text-2xl font-semibold"
				>
					Build
				</h1>
				<p className="mt-1 text-sm text-muted">
					The saved source workspace is compiled through the same validator used by game
					authoring.
				</p>
			</header>
			<article className="rounded-2xl border border-line bg-surface/85 p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="text-lg font-semibold">Project validation</h2>
						<p className="mt-1 text-sm text-muted">
							{!configured
								? "Configure the project root before validation and arkpack output become available."
								: stale
									? `${stagedCount} staged item change${stagedCount === 1 ? " is" : "s are"} not included in this validation result. Save the project before building.`
									: `The saved project compiled successfully with ${project.diagnostics.length} non-blocking diagnostic${project.diagnostics.length === 1 ? "" : "s"}.`}
						</p>
					</div>
					<span
						className={
							!configured
								? "rounded-full bg-surface-raised px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted"
								: stale
									? "rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-warning"
									: "rounded-full bg-success/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-success"
						}
					>
						{!configured ? "Not configured" : stale ? "Drafts pending" : "Valid"}
					</span>
				</div>
				{project.diagnostics.length === 0 ? null : (
					<div className="mt-4 grid gap-2">
						{stale ? (
							<p className="text-xs font-semibold uppercase tracking-wider text-muted">
								Diagnostics from the last saved revision
							</p>
						) : null}
						<ul className="grid gap-2">
							{project.diagnostics.map((diagnostic, index) => (
								<li
									key={`${diagnostic.code}-${diagnostic.source ?? "project"}-${index}`}
									className="rounded-lg bg-surface-raised p-3 text-sm text-muted"
								>
									<span className="font-semibold text-foreground">
										{diagnostic.code}
									</span>
									:{diagnostic.message}
								</li>
							))}
						</ul>
					</div>
				)}
			</article>
			<article className="rounded-2xl border border-line bg-surface/85 p-5">
				<h2 className="text-lg font-semibold">Signing and package output</h2>
				<p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
					Arkpack output and optional signing-key input are not enabled in this editor
					foundation.
				</p>
				<div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
					<input
						type="file"
						disabled
						aria-label="Signing key"
						className="block min-w-0 w-full text-sm text-muted disabled:cursor-not-allowed disabled:opacity-60"
					/>
					<PrimaryButton
						disabled
						cursorIntent="not-allowed"
					>
						Build arkpack
					</PrimaryButton>
				</div>
			</article>
		</section>
	);
};

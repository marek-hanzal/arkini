import { Fragment } from "react";

interface EditorOriginFlowShortcutHelpProps {
	readonly onClose: () => void;
}

const ShortcutRows = [
	[
		"N",
		"Next item in the selected Income graph.",
	],
	[
		"P",
		"Previous item in the selected Income graph.",
	],
	[
		"H",
		"Return to the selected item, or the graph start when nothing is selected.",
	],
	[
		"I",
		"Cycle through items whose operations use the selected item as an input.",
	],
	[
		"O",
		"Cycle through items whose operations output the selected item.",
	],
	[
		"Z",
		"Go back through recently clicked items.",
	],
	[
		"?",
		"Open or close this help.",
	],
] as const;

/** Explains the keyboard navigation available on the Game Flow canvas. */
export const EditorOriginFlowShortcutHelp = ({ onClose }: EditorOriginFlowShortcutHelpProps) => (
	<div
		aria-labelledby="flow-shortcuts-title"
		aria-modal="true"
		className="absolute inset-0 z-20 grid place-items-center bg-black/20 p-6 backdrop-blur-[1px]"
		onPointerDown={(event) => {
			if (event.currentTarget === event.target) onClose();
		}}
		role="dialog"
	>
		<div className="w-full max-w-lg rounded-lg border border-line bg-surface-raised p-5 shadow-xl">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2
						className="text-lg font-semibold"
						id="flow-shortcuts-title"
					>
						Flow shortcuts
					</h2>
					<p className="mt-1 text-sm text-muted">
						Shortcuts follow the currently selected item.
					</p>
				</div>
				<button
					aria-label="Close shortcuts"
					className="grid size-8 shrink-0 place-items-center rounded-md border border-line text-muted hover:bg-surface hover:text-foreground"
					onClick={onClose}
					type="button"
				>
					<span className="icon-[lucide--x] size-4" />
				</button>
			</div>
			<div className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
				{ShortcutRows.map(([key, description]) => (
					<Fragment key={key}>
						<kbd className="min-w-8 rounded border border-line bg-surface px-2 py-1 text-center font-mono font-semibold">
							{key}
						</kbd>
						<span>{description}</span>
					</Fragment>
				))}
			</div>
			<p className="mt-5 text-xs text-muted">
				Keyboard shortcuts stay inactive while typing in a field. Press Esc to close help.
			</p>
		</div>
	</div>
);

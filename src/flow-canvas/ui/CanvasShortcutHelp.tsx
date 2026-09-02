import { X } from "lucide-react";
import { Fragment } from "react";

import type { OriginFlowDirection } from "~/flow-canvas/type/Highlight";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButton } from "~/ui/ui/LinkButton";
import { useOverlayFocus } from "~/ui/ui/useOverlayFocus";

interface CanvasShortcutHelpProps {
	readonly direction: OriginFlowDirection;
	readonly onCloseFn: () => void;
}

const readShortcutRowsFn = (direction: OriginFlowDirection) =>
	[
		[
			"N",
			`Next item in the selected ${direction === "output" ? "Output" : "Input"} graph.`,
		],
		[
			"P",
			`Previous item in the selected ${direction === "output" ? "Output" : "Input"} graph.`,
		],
		[
			"H",
			"Return to the selected item, or the graph start when nothing is selected.",
		],
		[
			"K",
			"Hide the farthest visible level of the selected graph.",
		],
		[
			"L",
			"Show one more hidden level of the selected graph.",
		],
		[
			"0",
			"Restore the default one-level view and return to the selected item.",
		],
		[
			"S",
			"Cycle terminal/root items of the selected graph to verify where the chain starts or ends.",
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
export const CanvasShortcutHelp = ({ direction, onCloseFn }: CanvasShortcutHelpProps) => {
	const { onKeyDownFn, overlayRef } = useOverlayFocus({
		onCloseFn,
	});
	const translator = useTranslator();
	return (
		<div
			className="absolute inset-0 z-20 grid place-items-center bg-black/20 p-6 backdrop-blur-[1px]"
			data-ui="EditorOriginFlowShortcutHelp"
			onKeyDown={onKeyDownFn}
			onPointerDown={(event) => {
				if (event.currentTarget === event.target) onCloseFn();
			}}
			ref={overlayRef}
		>
			<div className="w-full max-w-lg rounded-lg border border-line bg-surface-raised p-5 shadow-xl">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 className="text-lg font-semibold">Flow shortcuts</h2>
						<p className="mt-1 text-sm text-muted">
							Shortcuts follow the currently selected item.
						</p>
					</div>
					<LinkButton
						className="ml-auto inline-flex size-8 shrink-0 items-center justify-center no-underline"
						data-ui="EditorOriginFlowShortcutHelpClose"
						onClick={onCloseFn}
						title={translator.textFn("Close")}
					>
						<X className="size-5" />
					</LinkButton>
				</div>
				<div className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
					{readShortcutRowsFn(direction).map(([key, description]) => (
						<Fragment key={key}>
							<kbd className="min-w-8 rounded border border-line bg-surface px-2 py-1 text-center font-mono font-semibold">
								{key}
							</kbd>
							<span>{description}</span>
						</Fragment>
					))}
				</div>
				<p className="mt-5 text-xs text-muted">
					Keyboard shortcuts stay inactive while typing in a field. Press Esc to close
					help.
				</p>
			</div>
		</div>
	);
};

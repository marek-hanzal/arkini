import { FloatingPortal } from "@floating-ui/react";
import { ChevronDown, Images, PackageOpen } from "lucide-react";

import { Button, PrimaryButton } from "~/ui/button/Button";
import { useEditorFloatingMenu } from "~/authoring-shell/navigation/useEditorFloatingMenu";

export interface EditorAssetImportMenuProps {
	readonly onImportArkpack: () => void;
	readonly onImportFiles: () => void;
	readonly pending: boolean;
}

/** Keeps Arkpack as the one-click import while retaining direct PNG selection. */
export const EditorAssetImportMenu = ({
	onImportArkpack,
	onImportFiles,
	pending,
}: EditorAssetImportMenuProps) => {
	const { floatingStyles, getFloatingProps, getReferenceProps, open, refs, setOpen } =
		useEditorFloatingMenu();
	const runImport = (importAssets: () => void) => {
		setOpen(false);
		importAssets();
	};

	return (
		<>
			<div
				className="inline-flex h-12 min-h-12 shrink-0 overflow-hidden rounded-lg shadow-lg"
				data-ui="EditorAssetImportControl"
			>
				<PrimaryButton
					className="h-full min-h-0 gap-2 rounded-r-none px-4 shadow-none"
					cursorIntent={pending ? "progress" : undefined}
					data-ui="EditorAssetImport"
					disabled={pending}
					onClick={onImportArkpack}
				>
					<PackageOpen className="size-4" />
					Import assets
				</PrimaryButton>
				<PrimaryButton
					ref={refs.setReference}
					className="h-full min-h-0 rounded-l-none border-l border-accent-contrast/25 px-3 shadow-none"
					cursorIntent={pending ? "progress" : undefined}
					data-ui="EditorAssetImportMenuTrigger"
					disabled={pending}
					{...getReferenceProps()}
				>
					<ChevronDown className="size-4" />
				</PrimaryButton>
			</div>
			{open ? (
				<FloatingPortal>
					<div
						ref={refs.setFloating}
						style={floatingStyles}
						className="z-50 grid w-80 max-w-[calc(100vw-1rem)] gap-1 rounded-xl border border-line-strong bg-surface p-1.5 shadow-2xl"
						data-ui="EditorAssetImportMenu"
						{...getFloatingProps()}
					>
						<Button
							className="min-h-0 justify-start gap-3 border-0 bg-transparent px-2.5 py-2 text-left shadow-none"
							data-ui="EditorAssetImportArkpackOption"
							onClick={() => runImport(onImportArkpack)}
						>
							<PackageOpen className="size-5 shrink-0 text-accent" />
							<span>
								<span className="block font-semibold">From arkpack</span>
								<span className="mt-0.5 block text-xs font-normal leading-4 text-muted">
									Imports all assets and overrides matching resource IDs.
								</span>
							</span>
						</Button>
						<Button
							className="min-h-0 justify-start gap-3 border-0 bg-transparent px-2.5 py-2 text-left shadow-none"
							data-ui="EditorAssetImportFilesOption"
							onClick={() => runImport(onImportFiles)}
						>
							<Images className="size-5 shrink-0 text-accent" />
							<span>
								<span className="block font-semibold">PNG files</span>
								<span className="mt-0.5 block text-xs font-normal leading-4 text-muted">
									Imports selected PNG files using their filenames as resource
									IDs.
								</span>
							</span>
						</Button>
					</div>
				</FloatingPortal>
			) : null}
		</>
	);
};

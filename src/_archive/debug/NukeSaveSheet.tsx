import { type FC, useCallback, useState } from "react";
import { createDefaultDexieGameSaveStorage } from "~/storage/DexieGameSaveStorage";
import { SheetHeader } from "~/play/sheet/SheetHeader";
import { UiButton } from "~/ui/UiButton";
import { UiSection } from "~/ui/UiSection";

export namespace NukeSaveSheet {
	export interface Props {
		onClose(): void;
	}
}

export const NukeSaveSheet: FC<NukeSaveSheet.Props> = ({ onClose }) => {
	const [status, setStatus] = useState<"idle" | "pending" | "failed">("idle");

	const nukeSave = useCallback(() => {
		setStatus("pending");
		const storage = createDefaultDexieGameSaveStorage();

		void storage
			.deleteActiveSave()
			.then(() => window.location.reload())
			.catch((error: unknown) => {
				console.error("Failed to nuke Arkini save", error);
				setStatus("failed");
			})
			.finally(() => storage.close());
	}, []);

	return (
		<section
			data-ui="nuke save sheet"
			className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 w-full flex-col overflow-hidden bg-ak-surface"
		>
			<SheetHeader
				title="Nuke Save"
				onClose={onClose}
			/>
			<div className="mx-auto grid min-h-0 w-full max-w-[460px] flex-1 gap-3 overflow-y-auto overscroll-contain px-3 py-3">
				<UiSection
					eyebrow="Danger"
					title="Delete current save"
				>
					<p className="text-sm leading-6 text-ak-text-muted">
						This deletes the active local Arkini save and reloads the game into a fresh
						run. There is no undo, because apparently even destruction needs UX copy.
					</p>
					<div className="mt-3">
						<UiButton
							tone="danger"
							disabled={status === "pending"}
							onClick={nukeSave}
						>
							{status === "pending" ? "Nuking save…" : "Confirm nuke save"}
						</UiButton>
					</div>
					{status === "failed" ? (
						<p className="mt-3 text-sm font-semibold text-rose-700">
							Nuke failed. Check the console, because naturally even deletion can
							break.
						</p>
					) : null}
				</UiSection>
			</div>
		</section>
	);
};

import type { FC } from "react";
import { useState } from "react";

export namespace HardResetButton {
	export interface Props {
		label?: string;
	}
}

export const HardResetButton: FC<HardResetButton.Props> = ({ label = "Hard reset database" }) => {
	const [resetState, setResetState] = useState<"idle" | "pending" | "failed">("idle");

	async function hardReset() {
		setResetState("pending");
		try {
			const db = await import("~/play/logic/playBackend");
			await db.hardResetDatabaseFile();
			window.location.reload();
		} catch (error) {
			console.error(error);
			setResetState("failed");
		}
	}

	return (
		<div>
			<button
				type="button"
				disabled={resetState === "pending"}
				onClick={hardReset}
				className="w-full rounded-md border border-red-300/45 bg-red-300 px-4 py-3 text-sm font-black text-slate-950 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
			>
				{resetState === "pending" ? "Dropping database…" : label}
			</button>
			{resetState === "failed" ? (
				<p className="mt-3 text-sm text-red-100">Reset failed. Check the console.</p>
			) : null}
		</div>
	);
};

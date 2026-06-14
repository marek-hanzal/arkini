import { useMachine } from "@xstate/react";
import type { FC } from "react";
import { resetWorkflowMachine } from "~/shared/logic/resetWorkflowMachine";

export namespace RootErrorBoundary {
	export interface Props {
		error: unknown;
	}
}

export const RootErrorBoundary: FC<RootErrorBoundary.Props> = ({ error }) => {
	const [resetState, sendReset] = useMachine(resetWorkflowMachine);
	const pending = resetState.matches("pending");
	const failed = resetState.matches("failed");
	const message = error instanceof Error ? error.message : String(error);

	async function hardResetBrowserStorage() {
		sendReset({
			type: "START",
		});

		try {
			await (
				(await navigator.storage.getDirectory()) as FileSystemDirectoryHandle & {
					remove(options: { recursive: boolean }): Promise<void>;
				}
			).remove({
				recursive: true,
			});
			window.location.reload();
		} catch (error) {
			console.error(error);
			sendReset({
				type: "FAIL",
			});
		}
	}

	return (
		<main className="grid h-dvh w-dvw place-items-center bg-slate-950 p-4 text-slate-100">
			<section className="w-full max-w-xl rounded-md border border-red-400/35 bg-red-950/28 p-5 shadow-2xl shadow-red-950/35">
				<p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-red-200">
					Arkini crashed
				</p>
				<h1 className="mt-3 text-2xl font-black text-red-50">Database/runtime error</h1>
				<p className="mt-3 text-sm leading-6 text-red-100">
					The local save can be force-dropped if migrations or cached OPFS state got into
					a broken loop. Elegant? No. Effective? Annoyingly, yes.
				</p>
				<pre className="mt-4 max-h-56 overflow-auto rounded-sm bg-slate-950/70 p-3 text-xs whitespace-pre-wrap text-red-100">
					{message}
				</pre>
				<div className="mt-4">
					<button
						type="button"
						disabled={pending}
						onClick={hardResetBrowserStorage}
						className="w-full rounded-md border border-red-300/45 bg-red-300 px-4 py-3 text-sm font-black text-slate-950 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
					>
						{pending ? "Dropping browser storage…" : "Hard reset browser storage"}
					</button>
					{failed ? (
						<p className="mt-3 text-sm text-red-100">
							Reset failed. Check the console.
						</p>
					) : null}
				</div>
			</section>
		</main>
	);
};

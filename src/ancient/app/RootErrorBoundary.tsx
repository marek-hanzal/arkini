import { useEffect, type FC } from "react";
import { useHardResetAction } from "~/shared/hook/useHardResetAction";
import { hardResetBrowserStorage } from "~/shared/util/hardResetBrowserStorage";
import { logResetError } from "~/shared/util/logResetError";
import { reloadWindow } from "~/shared/util/reloadWindow";

export namespace RootErrorBoundary {
	export interface Props {
		error: unknown;
	}
}

export const RootErrorBoundary: FC<RootErrorBoundary.Props> = ({ error }) => {
	const reset = useHardResetAction({
		reset: hardResetBrowserStorage,
		onSuccess: reloadWindow,
		onError: logResetError,
	});
	const message = error instanceof Error ? error.message : String(error);

	useEffect(() => {
		void reset.run();
	}, [
		reset.run,
	]);

	return (
		<main className="grid h-dvh w-dvw place-items-center bg-slate-950 p-4 text-slate-100">
			<section className="w-full max-w-xl rounded-md border border-red-400/35 bg-red-950/28 p-5 shadow-2xl shadow-red-950/35">
				<p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-red-200">
					Arkini crashed
				</p>
				<h1 className="mt-3 text-2xl font-black text-red-50">Hard reset in progress</h1>
				<p className="mt-3 text-sm leading-6 text-red-100">
					The game hit a runtime or database error. Arkini now drops OPFS browser storage
					immediately and reloads, because prototype saves are disposable and startup
					loops are not a design pillar.
				</p>
				<pre className="mt-4 max-h-56 overflow-auto rounded-sm bg-slate-950/70 p-3 text-xs whitespace-pre-wrap text-red-100">
					{message}
				</pre>
				<div className="mt-4">
					<button
						type="button"
						disabled={reset.pending}
						onClick={() => void reset.run()}
						className="w-full rounded-md border border-red-300/45 bg-red-300 px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-wait disabled:opacity-60"
					>
						{reset.pending ? "Dropping OPFS storage…" : "Retry OPFS hard reset"}
					</button>
					{reset.failed ? (
						<p className="mt-3 text-sm text-red-100">
							Automatic reset failed. Check the console.
						</p>
					) : null}
				</div>
			</section>
		</main>
	);
};

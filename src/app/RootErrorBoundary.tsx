import { useEffect, type FC } from "react";
import { useRootHardResetAction } from "~/app/useRootHardResetAction";

export namespace RootErrorBoundary {
	export interface Props {
		error: unknown;
	}
}

export const RootErrorBoundary: FC<RootErrorBoundary.Props> = ({ error }) => {
	const reset = useRootHardResetAction();
	const message = error instanceof Error ? error.message : String(error);

	useEffect(() => {
		void reset.run();
	}, [
		reset.run,
	]);

	return (
		<main className="grid h-dvh w-dvw place-items-center bg-ak-page p-4 text-ak-text">
			<section className="w-full max-w-xl rounded-xl border border-rose-300/50 bg-white/85 p-5 shadow-2xl shadow-rose-900/10">
				<p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-rose-700">
					Arkini crashed
				</p>
				<h1 className="mt-3 text-2xl font-black text-rose-900">Hard reset in progress</h1>
				<p className="mt-3 text-sm leading-6 text-rose-800">
					The game hit a runtime error. Arkini now drops browser storage immediately and
					reloads, because prototype saves are disposable and startup loops are not a
					design pillar.
				</p>
				<pre className="mt-4 max-h-56 overflow-auto rounded-lg bg-rose-50 p-3 text-xs whitespace-pre-wrap text-rose-800">
					{message}
				</pre>
				<div className="mt-4">
					<button
						type="button"
						disabled={reset.pending}
						onClick={() => void reset.run()}
						className="ak-ui-button ak-ui-button-danger w-full disabled:cursor-wait"
					>
						{reset.pending
							? "Dropping browser storage…"
							: "Retry browser storage reset"}
					</button>
					{reset.failed ? (
						<p className="mt-3 text-sm text-rose-800">
							Automatic reset failed. Check the console.
						</p>
					) : null}
				</div>
			</section>
		</main>
	);
};

import type { FC } from "react";

export namespace DevErrorPage {
	export interface Props {
		error: Error;
	}
}

export const DevErrorPage: FC<DevErrorPage.Props> = ({ error }) => (
	<main className="grid min-h-dvh place-items-center bg-slate-950 px-6 text-slate-100">
		<section className="w-full max-w-2xl rounded-2xl border border-rose-900/70 bg-rose-950/30 p-6">
			<p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-300">
				Dev inspector failed
			</p>
			<h1 className="mt-3 text-2xl font-bold">
				The tool managed to inspect itself into a wall.
			</h1>
			<pre className="mt-5 overflow-auto rounded-xl bg-slate-950/80 p-4 text-sm text-rose-100">
				{error.stack ?? error.message}
			</pre>
		</section>
	</main>
);

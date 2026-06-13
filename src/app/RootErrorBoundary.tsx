import type { FC } from "react";
import { HardResetButton } from "~/play/ui/HardResetButton";

export namespace RootErrorBoundary {
	export interface Props {
		error: unknown;
	}
}

export const RootErrorBoundary: FC<RootErrorBoundary.Props> = ({ error }) => {
	const message = error instanceof Error ? error.message : String(error);

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
					<HardResetButton />
				</div>
			</section>
		</main>
	);
};

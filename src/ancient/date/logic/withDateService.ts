import { Effect } from "effect";
import { DateServiceFx, type DateService } from "~/date/context/DateServiceFx";

export function withDateService(date: DateService) {
	return <A, E, R>(effect: Effect.Effect<A, E, R>) => {
		return effect.pipe(Effect.provideService(DateServiceFx, date));
	};
}

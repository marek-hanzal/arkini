type DataUiValue = boolean | number | string | undefined;

type KebabCase<Value extends string> = Value extends `${infer Head}${infer Tail}`
	? Tail extends Uncapitalize<Tail>
		? `${Lowercase<Head>}${KebabCase<Tail>}`
		: `${Lowercase<Head>}-${KebabCase<Uncapitalize<Tail>>}`
	: Value;

export namespace readDataUiFn {
	export type State = Readonly<Record<string, DataUiValue>>;

	export type Output<State extends readDataUiFn.State> = {
		readonly "data-ui": string;
	} & {
		readonly [Key in keyof State as `data-ui-${KebabCase<Key & string>}`]: State[Key];
	};

	export interface Props<State extends readDataUiFn.State> {
		readonly dataUi: string;
		readonly state: State;
	}
}

const toKebabCaseFn = (value: string) =>
	value.replaceAll(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);

/** Projects one typed semantic state object into the shared data-ui attribute language. */
export const readDataUiFn = <const State extends readDataUiFn.State>({
	dataUi,
	state,
}: readDataUiFn.Props<State>): readDataUiFn.Output<State> => {
	const attributes: Record<string, DataUiValue> = {
		"data-ui": dataUi,
	};
	for (const [key, value] of Object.entries(state)) {
		attributes[`data-ui-${toKebabCaseFn(key)}`] = value;
	}
	return attributes as readDataUiFn.Output<State>;
};

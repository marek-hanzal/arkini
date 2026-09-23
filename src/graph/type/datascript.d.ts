declare module "datascript" {
	interface Database {
		readonly __datascriptDatabase: unique symbol;
	}
	const datascript: {
		init_db(
			datoms: readonly (readonly [
				number,
				string,
				unknown,
			])[],
			schema?: Record<string, unknown>,
		): Database;
		q(query: string, ...inputs: unknown[]): unknown;
	};
	export default datascript;
}

declare module "*.css";

declare module "*.arkpack?url" {
	const url: string;
	export default url;
}

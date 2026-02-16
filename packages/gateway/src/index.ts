export { createKeyServer } from "./key-server/index.js";

// When run directly, start the key server
const isDirectRun =
	process.argv[1] &&
	(process.argv[1].endsWith("/gateway/dist/index.js") ||
		process.argv[1].endsWith("/gateway/src/index.ts"));

if (isDirectRun) {
	const { createKeyServer } = await import("./key-server/index.js");
	await createKeyServer();
}

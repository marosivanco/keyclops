const FS = require("fs");
const UglifyJS = require("uglify-es");

module.exports = {
	parallel: true,
	productionSourceMap: false,
	devServer: {
		port: 80,
		//TODO:
		allowedHosts: ["sales.dev.pbpartner.sk"],
	},
	chainWebpack: config => {
		config.plugins.delete("prefetch");
		config.plugins.delete("preload");
		config.plugin("html").tap(args => {
			// the base in your app would point to ./node_modules/keyclops
			const base = ".";
			const bootstrap = UglifyJS.minify(FS.readFileSync(`${base}/src/bootstrap.js`, "utf8"));
			// implements strategy for token storage, redirectUrl
			const cloak = UglifyJS.minify(FS.readFileSync(`./test/cloak.js`, "utf8"));
			// selects realm and clientId
			const keyclops = UglifyJS.minify(FS.readFileSync("./test/keyclops.js", "utf8"));
			args[0].favicon = "./test/favicon.ico";
			args[0].inject = true;
			args[0].inline = [bootstrap.code || bootstrap.error, cloak.code || cloak.error, keyclops.code || keyclops.error];
			args[0].minify = {
				removeComments: true,
				collapseWhitespace: true,
				removeAttributeQuotes: true,
				minifyCSS: true,
			};
			args[0].template = "./test/index.html";
			return args;
		});
		config
			.entry("app")
			.clear()
			.add("./test/main.js")
			.end();
	},
};

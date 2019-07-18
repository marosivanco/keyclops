const Babel = require("@babel/core");
const UglifyJS = require("uglify-es");

module.exports = {
	parallel: true,
	productionSourceMap: false,
	devServer: {
		allowedHosts: ["www.example.org"],
		port: 80,
	},
	chainWebpack: config => {
		config.plugins.delete("prefetch");
		config.plugins.delete("preload");
		config.plugin("html").tap(args => {
			args[0].favicon = "./test/favicon.ico";
			args[0].inject = true;
			// the base in your app would point to ./node_modules/keyclops
			const base = ".";
			args[0].inline = [
				`${base}/src/bootstrap.js`,
				// implements strategy for token storage, redirectUrl
				"./test/cloak.js",
				// selects realm and clientId
				"./test/keyclops.js",
			].map(name => UglifyJS.minify(Babel.transformFileSync(name, { configFile: `./babel.es5.config.js` }).code).code);
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

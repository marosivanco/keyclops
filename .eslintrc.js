module.exports = {
	root: true,
	env: {
		node: true,
	},
	extends: ["plugin:vue/essential", "@vue/prettier"],
	rules: {
		// allow console for development
		// TODO: remove
		"no-console": ["error", { allow: ["log", "warn", "error"] }],
		"no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
	},
	parserOptions: {
		parser: "babel-eslint",
	},
};

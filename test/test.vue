<template>
	<div>
		<h1>Keyclops Protected Test Page</h1>
		<div><img src="../doc/keyclops.svg" /></div>
		You are logged in as: <b>{{ login }}</b>
		<div><a @click="logout">Logout</a></div>
	</div>
</template>

<script>
import store from "./store";

export default {
	name: "test",
	computed: {
		login() {
			return this.$store.state.session.token.name;
		},
	},
	methods: {
		logout() {
			this.$store.dispatch("session/logout");
		},
	},
	store,
};
</script>
<style>
html {
	font-family: Roboto, Arial, Helvetica, sans-serif;
	font-size: 16px;
	line-height: 1.2;
	text-align: center;
}
body {
	margin: 30px;
}
a {
	color: #1d7607;
	cursor: pointer;
	text-decoration: underline;
}
h1 {
	color: #1d7607;
	font-size: 32px;
	font-weight: bold;
	margin: 0;
}
div {
	line-height: 1;
	margin: 10px 0;
}
img {
	height: 32px;
	margin-right: 10px;
	vertical-align: text-top;
}
</style>

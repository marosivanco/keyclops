import Vue from "vue";
import Vuex from "vuex";

import session from "./session";

Vue.use(Vuex);

const store = new Vuex.Store({
	modules: {
		// register module
		session: session.module,
	},
});
// trigger onload initialization
session.onLoad(store.commit, store.dispatch);
export default store;

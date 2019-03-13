import Keyclops from "../../src/flows/hybrid";

const getCookie = window.getCookie;
const setCookie = window.setCookie;
const keyclops = Keyclops && window.keyclops;
const TOKEN_UPDATE_TRESHOLD = 15 * 1000;
let MAX_INACTIVITY_TIME = 10 * 60 * 1000;
let lastInteraction = Date.now();
function format(diff) {
	return new Date(diff).toISOString().substr("1970-01-01T".length, "00:00:00.000".length);
}
function checkInteraction(dispatch) {
	const inactivity = Date.now() - lastInteraction;
	console.log("[SESSION]", "checkInteraction inactivity", inactivity, format(inactivity));
	if (inactivity > MAX_INACTIVITY_TIME) {
		dispatch("session/logout", true, { root: true });
	} else {
		let diff = MAX_INACTIVITY_TIME - inactivity;
		diff = diff < 0 ? 0 : diff;
		console.log("[SESSION]", "checkInteraction scheduled in", format(diff));
		setTimeout(() => {
			checkInteraction(dispatch);
		}, diff);
	}
}
function onLogin(dispatch) {
	console.log("[SESSION] onLogin");
	let timeoutId;
	// Record Interactions
	const updateInteraction = () => {
		// debounce
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			lastInteraction = Date.now();
			// trigger store event in other tabs
			localStorage.setItem("updateInteraction", `${lastInteraction}`);
			localStorage.removeItem("updateInteraction");
		}, 200);
	};
	// register event handlers for interaction recording
	["click", "input", "keypress", "mousemove"].forEach(name => {
		window.document.documentElement.addEventListener(name, updateInteraction, false);
	});
	// register listener for lastInteraction updates from other tabs
	window.addEventListener("storage", event => {
		if (event.key === "updateInteraction" && event.newValue) {
			lastInteraction = parseInt(event.newValue);
		}
	});
	// Check Interactions
	console.log("[SESSION]", "checkInteraction scheduled in", format(MAX_INACTIVITY_TIME));
	setTimeout(() => {
		checkInteraction(dispatch);
	}, MAX_INACTIVITY_TIME);
}
function scheduleAccessTokenUpdate(expires, dispatch) {
	let diff = expires.getTime() - Date.now() - TOKEN_UPDATE_TRESHOLD;
	diff = diff < 0 ? 0 : diff;
	console.log("[SESSION] scheduleTokenUpdate", diff, format(diff));
	setTimeout(() => dispatch("session/updateAccessToken", null, { root: true }), diff);
}
function handleTokenUpdate(commit, dispatch, doOnLogin) {
	const payload = keyclops.accessTokenPayload;
	console.log("[SESSION] handleTokenUpdate doOnLogin access token", doOnLogin, JSON.stringify(payload));
	if (payload) {
		const expires = new Date(payload.exp * 1000);
		if (expires.getTime() < Date.now()) {
			console.log("[SESSION] handleTokenUpdate access token expired");
			dispatch("session/logout", true, { root: true });
		} else {
			commit("session/setAccessToken", payload, { root: true });
			scheduleAccessTokenUpdate(expires, dispatch);
			if (doOnLogin) {
				onLogin(dispatch);
			}
		}
	}
}
function onLoad(commit, dispatch) {
	console.log("[SESSION] onLoad");
	// restore authentication state
	const accessToken = getCookie("Access-Token");
	const idToken = sessionStorage.getItem("Id-Token");
	const refreshToken = sessionStorage.getItem("Refresh-Token");
	keyclops
		// finish initialization
		.init({ accessToken, idToken, refreshToken })
		.then(() => {
			console.log("[SESSION] authenticated, access token", keyclops.accessTokenPayload);
			// update authentication state
			setCookie("Access-Token", keyclops.accessToken, new Date(keyclops.accessTokenPayload.exp * 1000));
			sessionStorage.setItem("Id-Token", keyclops.idToken);
			sessionStorage.setItem("Refresh-Token", keyclops.refreshToken);
			// update internal state and schedule flows
			handleTokenUpdate(commit, dispatch, true);
			// register SSO listener
			keyclops.onSingleSignOut = data => {
				console.log("[SESSION] onSingleSignOut", data);
				dispatch("session/logout", null, { root: true });
			};
		})
		// logout in case of error
		.catch(e => {
			console.log("[SESSION] Keyclops authentication failed.", e);
			dispatch("session/logout", null, { root: true });
		});
}
const module = {
	namespaced: true,
	state: {
		token: keyclops.accessTokenPayload,
	},
	mutations: {
		setAccessToken(state, payload) {
			console.log("[SESSION] Access-Token: ", payload);
			state.token = payload;
		},
	},
	actions: {
		logout(context, expiration) {
			console.log("[SESSION] logout");
			setCookie("Access-Token", "", new Date(0));
			sessionStorage.removeItem("Id-Token");
			sessionStorage.removeItem("Refresh-Token");
			const { protocol, host, hostname } = location;
			let target = keyclops.createLogoutUrl(`${protocol}//${host}/`);
			if (expiration) {
				const parts = host.split(".");
				if (hostname !== "localhost") {
					parts[0] = "accounts";
				}
				target = `${protocol}//${parts.join(".")}/expiration.html?redirect_uri=${encodeURIComponent(target)}`;
			}
			location.href = target;
		},
		updateAccessToken({ commit, dispatch }) {
			console.log("[SESSION] updateAccessToken");
			return keyclops
				.update()
				.then(data => {
					MAX_INACTIVITY_TIME = data.refresh_expires_in * 1000 || 10 * 60 * 1000;
					console.log("[SESSION] updateAccessToken token updated", keyclops.accessTokenPayload);
					setCookie("Access-Token", keyclops.accessToken, new Date(keyclops.accessTokenPayload.exp * 1000));
					sessionStorage.setItem("Id-Token", keyclops.idToken);
					sessionStorage.setItem("Refresh-Token", keyclops.refreshToken);
					handleTokenUpdate(commit, dispatch);
				})
				.catch(() => {
					console.log("[SESSION] updateAccessToken error, keyclops logout");
					dispatch("session/logout", null, { root: true });
				});
		},
	},
};
export default { module, onLoad };

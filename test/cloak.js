function getCookie(name) {
	const match = document.cookie.match(new RegExp("(^| )" + name.replace("-", "\\-") + "=([^;]+)"));
	return match ? match[2] : null;
}
function setCookie(name, value, expDate) {
	let expires = "";
	if (expDate) {
		expires = "; expires=" + expDate.toGMTString();
	}
	document.cookie = name + "=" + value + expires + ";path=/";
}

function cloak(realm, clientId) {
	function fastDecode(token) {
		const base = token
			.split(".")[1]
			.replace(/-/g, "+")
			.replace(/_/g, "/");
		return JSON.parse(atob(base));
	}
	function providerUrl() {
		const { protocol, host, hostname } = location;
		const parts = host.split(".");
		if (hostname !== "localhost") {
			parts[0] = "accounts";
		}
		return `${protocol}//${parts.join(".")}/auth`;
	}
	const keyclops = new Keyclops({ url: providerUrl(), realm, clientId });
	window.keyclops = keyclops;
	function login() {
		const { protocol, host, pathname, search } = location;
		location.href = keyclops.createLoginUrl(`${protocol}//${host}${pathname}${search}`, "code token");
	}
	function logout() {
		setCookie("Access-Token", "", new Date(0));
		const { protocol, host, pathname, search } = location;
		location.href = keyclops.createLogoutUrl(`${protocol}//${host}${pathname}${search}`);
	}
	function checkTokenAndSet(accessToken) {
		const accessTokenPayload = fastDecode(accessToken);
		console.log("[CLOAK] Access-Token", accessTokenPayload);
		const expires = new Date(accessTokenPayload.exp * 1000);
		const TOKEN_UPDATE_TRESHOLD = 15 * 1000;
		if (expires.getTime() - TOKEN_UPDATE_TRESHOLD < Date.now()) {
			logout();
		} else {
			keyclops.accessToken = accessToken;
			keyclops.accessTokenPayload = accessTokenPayload;
			setCookie("Access-Token", accessToken, expires);
			console.log("[CLOAK] Access-Token will expire in", (expires.getTime() - Date.now()) / 1000, "s");
		}
	}
	const { hash, href } = window.location;
	const accessToken = getCookie("Access-Token");
	const refreshToken = sessionStorage.getItem("Refresh-Token");
	if (accessToken && refreshToken) {
		console.log("[CLOAK] Existing access & refresh tokens.");
		checkTokenAndSet(accessToken);
		if (hash) {
			window.history.replaceState({}, null, href.substring(0, href.indexOf("#")));
		}
	} else if (hash) {
		// oauth continuation
		const params = hash
			.substring(1)
			.split("&")
			.reduce((ret, p) => {
				const idx = p.indexOf("=");
				if (idx !== -1) {
					ret[p.substring(0, idx)] = p.substring(idx + 1);
				}
				return ret;
			}, {});
		console.log("[CLOAK] OAuth continuation params", params);
		if (params.access_token) {
			checkTokenAndSet(params.access_token);
		}
	} else {
		login();
	}
}

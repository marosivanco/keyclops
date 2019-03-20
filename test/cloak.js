(function(window, location, history) {
	window.getCookie = name => {
		const match = document.cookie.match(new RegExp("(^| )" + name.replace("-", "\\-") + "=([^;]+)"));
		return match ? match[2] : null;
	};
	window.setCookie = (name, value, expDate) => {
		let expires = "";
		if (expDate) {
			expires = "; expires=" + expDate.toGMTString();
		}
		document.cookie = name + "=" + value + expires + ";path=/";
	};

	window.cloak = (realm, clientId) => {
		const l = location;
		function fastDecode(token) {
			const base = token
				.split(".")[1]
				.replace(/-/g, "+")
				.replace(/_/g, "/");
			return JSON.parse(atob(base));
		}
		function providerUrl() {
			const { protocol, host, hostname } = l;
			const parts = host.split(".");
			if (hostname !== "localhost") {
				parts[0] = "accounts";
			}
			return `${protocol}//${parts.join(".")}/auth`;
		}
		const keyclops = new Keyclops({ url: providerUrl(), realm, clientId });
		window.keyclops = keyclops;
		function logout() {
			setCookie("Access-Token", "", new Date(0));
			const { protocol, host, pathname, search } = l;
			l.href = keyclops.createLogoutUrl(`${protocol}//${host}${pathname}${search}`);
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
		let accessToken;
		const refreshToken = sessionStorage.getItem("Refresh-Token");
		if (refreshToken && (accessToken = getCookie("Access-Token"))) {
			console.log("[CLOAK] Existing access & refresh tokens.");
			checkTokenAndSet(accessToken);
			if (l.hash) {
				history.replaceState({}, null, l.href.substring(0, l.href.indexOf("#")));
			}
		} else if (l.hash) {
			// oauth continuation
			console.log("[CLOAK] oauth continuation");
			const params = l.hash
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
			l.href = keyclops.createLoginUrl(`${l.protocol}//${l.host}${l.pathname}${l.search}`, "code token");
		}
	};
})(window, location, history);

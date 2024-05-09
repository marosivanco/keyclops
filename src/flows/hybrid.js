/*eslint-disable no-console */
function decodePayload(token) {
	function toUtf8Char(str) {
		try {
			return decodeURIComponent(str);
		} catch (err) {
			return String.fromCharCode(0xfffd); // UTF 8 invalid char
		}
	}
	function toUtf8String(buf) {
		let res = "";
		let tmp = "";
		for (var i = 0; i < buf.length; i++) {
			if (buf[i] <= 0x7f) {
				res = `${res}${toUtf8Char(tmp)}${String.fromCharCode(buf[i])}`;
				tmp = "";
			} else {
				tmp = `${tmp}%${buf[i].toString(16)}`;
			}
		}
		return res + toUtf8Char(tmp);
	}
	const base = token
		.split(".")[1]
		.replace(/-/g, "+")
		.replace(/_/g, "/");
	const data = atob(base);
	const bytes = new Uint8Array(new ArrayBuffer(data.length));
	for (var i = 0; i < data.length; i++) {
		bytes[i] = data.charCodeAt(i);
	}
	return JSON.parse(toUtf8String(bytes));
}
const euc = encodeURIComponent;

const Keyclops = window.Keyclops;
Keyclops.prototype.log = function(...args) {
	if (this.logging) {
		console.log(...args);
	}
};
Keyclops.prototype.init = function(options) {
	if (!options) throw new Error("init options parameter is mandatory.");
	this.log("[KEYCLOPS] Implicit init params: flow = hybrid, responseMode = fragment, checkLoginIframe = true");
	this.log("[KEYCLOPS] Explicit init params:", options);

	const oauth = this.getOAuthParams(location.href);
	this.log("[KEYCLOPS] init oauth params:", JSON.stringify(oauth));
	if (oauth.newUrl) {
		this.log("[KEYCLOPS] history replaceState: ", oauth.newUrl);
		window.history.replaceState({}, null, oauth.newUrl);
		this.log("[KEYCLOPS] location: ", window.location);
	}
	this.setupSSOIframe().catch(() => {
		this.error("[KEYCLOPS] Unable to setup SSO iframe. ");
	});
	let ret;
	if (oauth.continue) {
		ret = this.processOAuthParams(oauth);
	} else if (options.accessToken && options.refreshToken) {
		this.set(options.accessToken, options.refreshToken, options.idToken);
		ret = Promise.resolve();
	} else {
		ret = Promise.reject(new Error("Illegal state: Neither OAuth continuation, nor a stored state."));
	}
	return ret;
};

Keyclops.prototype.update = function() {
	this.log("[KEYCLOPS] update");
	if (!this.refreshToken) return Promise.reject();

	return fetch(this.endpoints.token, {
		method: "POST",
		credentials: "include",
		headers: { "Content-type": "application/x-www-form-urlencoded" },
		body: `grant_type=refresh_token&refresh_token=${this.refreshToken}&client_id=${euc(this.clientId)}`,
	})
		.then(response => {
			if (response.ok) {
				return response.json();
			}
			throw response;
		})
		.then(data => {
			console.info("[KEYCLOPS] Tokens refreshed.");
			this.set(data.access_token, data.refresh_token, data.id_token);
			return data;
		})
		.catch(response => {
			this.warn("[KEYCLOPS] Failed to refresh tokens.");
			if (response.status === 400) {
				this.clear();
			}
			throw response;
		});
};

Keyclops.prototype.clear = function() {
	this.log("[KEYCLOPS] Clearing tokens.");
	this.refreshToken = this.refreshTokenPayload = this.idToken = this.idTokenPayload = this.accessToken = this.accessTokenPayload = null;
};
Keyclops.prototype.set = function(accessToken, refreshToken, idToken) {
	this.refreshToken = refreshToken;
	this.refreshTokenPayload = refreshToken && decodePayload(refreshToken);
	this.idToken = idToken;
	this.idTokenPayload = idToken && decodePayload(idToken);
	this.accessToken = accessToken;
	this.accessTokenPayload = accessToken && decodePayload(accessToken);
};

Keyclops.prototype.processOAuthParams = function({ code, error, error_description, redirectUrl, nonce }) {
	let ret;
	if (error) {
		ret = Promise.reject({ error, error_description });
	} else {
		console.log("[KEYCLOPS] processOAuthParams continuation");
		ret = fetch(this.endpoints.token, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: `code=${code}&grant_type=authorization_code&client_id=${euc(this.clientId)}&redirect_uri=${euc(
				redirectUrl,
			)}`,
		})
			.then(response => {
				if (response.ok) {
					return response.json();
				}
				throw response;
			})
			.then(data => {
				console.log("[KEYCLOPS] processOAuthParams POST then", data);
				this.set(data.access_token, data.refresh_token, data.id_token);
				if (
					this.checkNonce &&
					((this.accessTokenPayload && this.accessTokenPayload.nonce !== nonce) ||
						(this.refreshTokenPayload && this.refreshTokenPayload.nonce !== nonce) ||
						(this.idTokenPayload && this.idTokenPayload.nonce !== nonce))
				) {
					console.warn("[KEYCLOPS] Invalid nonce, clearing tokens");
					this.clear();
					throw new Error("[KEYCLOPS] Invalid nonce");
				}
				return data;
			})
			.catch(response => {
				console.log("[KEYCLOPS] processOAuthParams POST catch", response);
				throw response;
			});
	}
	return ret;
};

Keyclops.prototype.getOAuthParams = function(url) {
	function parseOAuth(url) {
		const supported = [
			"access_token",
			"code",
			"error",
			"error_description",
			"error_uri",
			"expires_in",
			"id_token",
			"iss",
			"session_state",
			"state",
			"token_type"
		];
		const oauth = { continue: false };
		const idx = url.indexOf("#");
		if (idx !== -1) {
			const hash = url.substring(idx + 1);
			const params = [];
			hash.split("&").forEach(p => {
				const [name, value] = p.split("=");
				if (supported.indexOf(name) === -1) {
					params.push(p);
				} else {
					oauth[name] = value;
				}
			});
			if ((oauth.code || oauth.error) && oauth.state) {
				oauth.newUrl = url.substring(0, idx) + (params.length ? "#" + params.join("&") : "");
				oauth.continue = true;
			}
		}
		return oauth;
	}
	let oauthStateStored = JSON.parse(sessionStorage.getItem("kc"));
	this.log("[KEYCLOPS] getOAuthParams stored oauthState", oauthStateStored);
	sessionStorage.removeItem("kc");
	const oauthStateParsed = parseOAuth(url);
	if (!oauthStateStored) {
		oauthStateStored = { redirectUrl: oauthStateParsed.newUrl };
		this.log("[KEYCLOPS] getOAuthParams deduced oauthState", oauthStateStored);
	}
	return Object.assign(oauthStateParsed, oauthStateStored);
};

Keyclops.prototype.setupSSOIframe = function() {
	this.log("[KEYCLOPS] setupSSOIframe", this.sso.enable);
	if (!this.sso.enable || this.sso.iframe) return Promise.resolve();

	return new Promise(resolve => {
		const iframe = document.createElement("iframe");
		let intervalID;
		this.sso.iframe = iframe;
		iframe.onload = () => {
			const authUrl = this.endpoints.authorize;
			this.log("[KEYCLOPS] iframe onload authUrl", authUrl);
			// TODO: externalize getOrigin
			const origin = location.origin || `${location.protocol}//${location.host}`;
			this.sso.origin = authUrl.charAt(0) === "/" ? origin : authUrl.substring(0, authUrl.indexOf("/", 8));
			resolve();
			intervalID = setInterval(() => {
				if (this.sso.iframe && this.sso.origin && this.accessTokenPayload) {
					this.sso.iframe.contentWindow.postMessage(
						`${this.clientId} ${this.accessTokenPayload.session_state}`,
						this.sso.origin,
					);
				}
			}, this.sso.interval * 1000);
		};
		iframe.setAttribute("src", this.endpoints.ssoIframeSrc);
		iframe.style.display = "none";
		// delay iframe loading so it does not compete with other resources
		if (document.readyState === "complete") {
			document.body.appendChild(iframe);
		} else {
			window.addEventListener("load", () => {
				document.body.appendChild(iframe);
			});
		}

		window.addEventListener("message", ({ data, origin, source }) => {
			if (origin !== this.sso.origin || this.sso.iframe.contentWindow !== source) return;
			if (!(data === "unchanged" || data === "changed" || data === "error")) return;
			if (data !== "unchanged") {
				if (intervalID) {
					clearInterval(intervalID);
				}
				this.clear();
				this.onSingleSignOut && this.onSingleSignOut(data);
			}
		});
	});
};
export default Keyclops;

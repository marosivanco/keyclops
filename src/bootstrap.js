console.log("[KEYCLOPS] bootstrap");

function Keyclops({ url, realm, clientId, sso, checkNonce }) {
	if (!clientId) throw "clientId missing";
	if (!realm) throw "realm missing";
	if (!url) throw "url missing";

	this.url = url;
	this.realm = realm;
	this.clientId = clientId;
	// setupOidcEndpoints
	const ppath = `${url}/realms/${encodeURIComponent(realm)}/protocol/openid-connect`;
	this.endpoints = {
		authorize: `${ppath}/auth`,
		token: `${ppath}/token`,
		logout: `${ppath}/logout`,
		ssoIframeSrc: `${ppath}/login-status-iframe.html`,
	};
	this.sso = {
		enable: !(sso && sso.enable === false),
		interval: (sso && sso.interval) || 5,
	};
	this.checkNonce = checkNonce;
}

function createUUID() {
	var s = [];
	var hexDigits = "0123456789abcdef";
	for (var i = 0; i < 36; i++) {
		s[i] = hexDigits.charAt(Math.floor(Math.random() * 0x10));
	}
	s[14] = "4";
	s[19] = hexDigits.charAt((s[19] & 0x3) | 0x8);
	s[8] = s[13] = s[18] = s[23] = "-";
	return s.join("");
}

Keyclops.prototype.createLoginUrl = function(redirectUrl, responseType) {
	const euc = encodeURIComponent;
	const state = createUUID();
	const nonce = createUUID();
	sessionStorage.setItem("kc", JSON.stringify({ nonce, redirectUrl, state }));
	return `${this.url}/realms/${euc(this.realm)}/protocol/openid-connect/auth?client_id=${euc(
		this.clientId,
	)}&redirect_uri=${euc(redirectUrl)}&state=${state}&response_mode=fragment&response_type=${euc(
		responseType,
	)}&scope=openid&nonce=${nonce}`;
};
Keyclops.prototype.createLogoutUrl = function(redirectUrl) {
	const euc = encodeURIComponent;
	return `${this.url}/realms/${euc(this.realm)}/protocol/openid-connect/logout?redirect_uri=${euc(redirectUrl)}`;
};

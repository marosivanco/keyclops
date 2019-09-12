# <img height="26px" src="./doc/keyclops.svg"> Keyclops JS

Responsive javascript client for [Keycloak](https://www.keycloak.org/).

<!-- TOC -->

- [1. Introduction](#1-introduction)
  - [1.1. Time to First Interaction](#11-time-to-first-interaction)
  - [1.2. Response Time of User Interaction](#12-response-time-of-user-interaction)
- [2. Notable changes](#2-notable-changes)
  - [2.1. Token update pattern](#21-token-update-pattern)
  - [2.2. Removed support for implicit and standard OIDC flow](#22-removed-support-for-implicit-and-standard-oidc-flow)
  - [2.3. Removed TimeSkew](#23-removed-timeskew)
  - [2.4. Flow is split into two sources](#24-flow-is-split-into-two-sources)
  - [2.5. Removed Dynamic Configuration](#25-removed-dynamic-configuration)
  - [2.6. Removed support for Cordova et al.](#26-removed-support-for-cordova-et-al)
  - [2.7. Other Improvements](#27-other-improvements)
- [3. Other Challenges](#3-other-challenges)
  - [3.1. How to access protected resources via link](#31-how-to-access-protected-resources-via-link)
  - [3.2. Time Difference between Application and Keycloak](#32-time-difference-between-application-and-keycloak)
  - [3.3. SPA in multiple tabs](#33-spa-in-multiple-tabs)
  - [3.4. Single Sign-On among multiple apps](#34-single-sign-on-among-multiple-apps)
  - [3.5. Single Sign-Out among multiple apps](#35-single-sign-out-among-multiple-apps)
  - [3.6. Server-side Session Invalidation](#36-server-side-session-invalidation)
  - [3.7. Avoiding credential re-entering after Keycloak's login timeout](#37-avoiding-credential-re-entering-after-keycloaks-login-timeout)
- [4. API](#4-api)
  - [4.1. Constructor](#41-constructor)
  - [4.2. Properties](#42-properties)
    - [4.2.1. accessToken](#421-accesstoken)
    - [4.2.2. accessTokenPayload](#422-accesstokenpayload)
    - [4.2.3. idToken](#423-idtoken)
    - [4.2.4. idTokenPayload](#424-idtokenpayload)
    - [4.2.5. refreshToken](#425-refreshtoken)
    - [4.2.6. refreshTokenPayload](#426-refreshtokenpayload)
  - [4.3. Methods](#43-methods)
    - [4.3.1. createLoginUrl](#431-createloginurl)
    - [4.3.2. createLogoutUrl](#432-createlogouturl)
    - [4.3.3. init](#433-init)
    - [4.3.4. update](#434-update)
    - [4.3.5. clear](#435-clear)
    - [4.3.6. set](#436-set)
  - [4.4. Life-cycle events](#44-life-cycle-events)
    - [4.4.1. onSingleSignOut](#441-onsinglesignout)
- [5. Putting things together](#5-putting-things-together)
  - [5.1. Keycloak Admin Configuration](#51-keycloak-admin-configuration)
  - [5.2. Run the test application](#52-run-the-test-application)
  - [5.3. Inside the Test App](#53-inside-the-test-app)
    - [5.3.1. Bootstrap](#531-bootstrap)
    - [5.3.2. Application Initialization](#532-application-initialization)
- [6. Acknowledgement](#6-acknowledgement)
- [7. License](#7-license)

<!-- /TOC -->

# 1. Introduction

[Keycloak](https://www.keycloak.org/) is an open source Identity and Access Management solution. It comes with its own JS client - [Keycloak JS](https://www.keycloak.org/docs/latest/securing_apps/index.html#_javascript_adapter). Unfortunately, the client is _unsuitable_ for creating responsive applications. Mostly because it messes with the [critical rendering path](https://developers.google.com/web/fundamentals/performance/critical-rendering-path/) during the application bootstrap.
But wait, what is a _responsive_ application? Well, it is an application, which responds swiftly to the user interactions. It has following properties (among others):

- Short time to first interaction (TTFI)
- Short response time of user interactions

The terms "swiftly" and "short time", are subjective. The concrete value (in ms) varies case by case. Responsivity of an application with 1000ms TTFI can be considered good, while the same 1000ms TTFI for other application can be considered poor.
While timing aspect is the major one, there are also aspects of "ergonomics" and multi-device support hidden in the term "responsiveness". The motivation is to speed up intent-to-action time, or at the very least, make the action possible (by changing size, position... on the small devices).
For the purpose of this document we will stick with the timing aspect.

## 1.1. Time to First Interaction

When user types the application URL in the browser, in order to be responsive, the app should load swiftly to actually enable the user interactions.
This means loading as little application resources as necessary (javascript, css, html, fonts, images), and performing only necessary service requests.

For instance, if your app requires the user to be authenticated, the first screen of the unauthenticated user will be the login screen, and the first interaction will be the actual login. Anything, that is not part of the login screen or login process (for instance Password Reset screens) consumes network and CPU resources and increases TTFI. Similarly, the app should make only such service requests that support the login (for instance load configuration, list identity providers), anything else just increases TTFI.

It is necessary to add, that the matter is more complicated. Decreasing TTFI usually comes with decreased source code manageability, because you typically need to split application code, employ dynamic loading, do some font subsetting, give resource and service requests the specific order...

Also, the User Login is just one use-case. The other may be Home screen, or, let's say List of Active Contracts. Optimizing TTFI of the Login may worsen TTFI of the Home screen. So, it all depends on the goals you set for your application, and the way you balance manageability and various use-cases.

Sometimes, as when you use Keycloak screens for authentication, the first interaction of an unauthenticated user is _outside_ of your application (Keycloak login screen).
In such case, you need to detect that user is not authenticated and redirect him/her to Keycloak as-soon-as-possible to avoid unnecessary resource/service requests and application bootstrap.

## 1.2. Response Time of User Interaction

When the application is ready, the user can interact. The interaction can be explicit - clicking the "Login" button, or implicit - evaluating password strength as the user types in his/her password during Registration. The interaction can be local (computation), or can involve the (remote) service requests. For the feeling of uninterrupted user experience, the response time of the interaction should be as low as possible.

When the interaction invokes a protected service, the application needs to make sure the request will be successfully authenticated. It does so by including valid access token in the service request. The Keycloak JS way of doing it is wrapping _every_ protected service request with kind of decorator that checks access token validity and renews the token when it is about to expire. This access token renewal involves additional service request. For instance, when the access token expires in 2 minutes, at least one request every 2 minutes is slowed down by additional token renewal request.

# 2. Notable changes

Keyclops is to the large extent defined by what it does not contain comparing to Keycloak JS. Instead of being "complete", the Keyclops approach is to remove anything that is not used, does not target web application, results in poor responsiveness, or can/should be externalized.
Moreover, Keyclops changes fundamental concept of token update. It is also split into multiple sources, allowing fast authentication state detection.

The results in the terms of code size are summarized in the following table:

| Size          | Keycloak JS | Keyclops                          | Keyclops + App-specific handling     |
| ------------- | ----------- | --------------------------------- | ------------------------------------ |
| Source        | 59 kB       | 9.15 kB (7.7 + 1.6)<sup>1</sup>   | 11.65 kB (9.15 + 2.5)<sup>2</sup>    |
| Minified      | 21 kB       | 6.44 kB (5.44 + 1.2)<sup>1</sup>  | 8 kB (6.44 + 1.6)<sup>2</sup>        |
| Minified+gzip | 6.3 kB      | 1.95 kB (1.28 + 0.67)<sup>1</sup> | **2.8 kB** (1.95 + 0.84)<sup>2</sup> |

<sup>1</sup> Hybrid flow + bootstrap

<sup>2</sup> Hybrid flow + bootstrap + app-specific code

## 2.1. Token update pattern

**Keycloak JS** way of avoiding unauthorized service requests is wrapping _every_ request to the protected service with kind of decorator that checks access token validity, and renews the token when it is about to expire. The situation is depicted in _Service Request + Token Update_ flow on the following diagram:
![Keycloak Token Update](./doc/keycloak-token-update.png)
When the user wants to see a List of contracts, s/he clicks the item in the application navigation. Prior to every call, the application checks the token expiration. If the token is (about to be) expired, it is updated prior the service call. This token update blocks not just the subsequent service call, but all the other service calls made in parallel while the token is being updated. If the access token expires in 2 minutes, at least one request every 2 minutes is slowed down by additional token renewal request.

There is also other flow: _Check Single Sign-out_, parallel to the Service Request + Token Update flow. If enabled, the flow checks existence of SSO cookies in an embedded iframe. The check requires _no_ network request, it is local. When the cookies expire, or if another app/window/tab clears the cookies, they are no longer readable by the SSO iframe, which indicates that Single Sign-Out occurred.

**Keyclops** takes a different approach. Instead of wrapping every service request, it splits the work into separate (parallel) flows:
![Keyclops Token Update](./doc/keyclops-token-update.png)
_The service request_ (Service Request flow) is _guaranteed_ to have valid access token. Because the token is valid, there is no need to check, or update it. And there is _no overhead_.

_Token Renewal_ flow is parallel to Service Request flow. It is started during the application bootstrap. Its sole purpose is to keep the access token valid. It does so by scheduling the token update based on its expiration time and some `GRACE` period. This grace period ensures, that the token is valid for the whole service tree, and that the service calls can use the token while the new is being issued. If left uninterrupted, the flow would keep the token updated _forever_. We however, want to stop the update, and logout the user, if s/he does not _interact_ with the application for defined amount of time.

_Record Interaction_ flow records the last time of user interaction. The application adds some event listeners for the specific events during the bootstrap. The events used to track the interaction can be `click`, `input`, `keypress`, or `mousemove`. The concrete events though, are application-specific.

_Check Interaction_ flow, well, it checks if the user's inactivity reached `MAX_INACTIVITY_TIME` threshold. If so, it (interrupts Token Renewal and) logs the user out. Otherwise, it schedules the next check.

_Check Single Sign-out_, if enabled, checks the existence of SSO cookies in an embedded iframe. The check requires _no_ network request, it is local. When the cookies expire, or if another app/window/tab clears the cookies, they are no longer readable by the SSO iframe, which indicates that Single Sign-Out occurred.

As you can see, the Keyclops token update is more complex. But we get:

- No service request overhead
- No need for refresh and callback queues to sync service requests during token update
- No `onTokenExpired` callback (expiration never happens)

## 2.2. Removed support for implicit and standard OIDC flow

_Implicit flow_ makes no sense in the context of a typical web application. In the implicit flow, there is no way to refresh the access token. Thus, after the token expiration, the user is forced to re-authenticate again.

_Standard flow_ loads token after application bootstrap (`onload`) in separate call, effectively torpedoing app bootstrap.

Keyclops implements only OIDC hybrid flow, because in the flow the access token is present also in the initial call. This implies that the responseType is fixed to `"code id_token token"`.

If you feel the implicit or standard flow are necessary for your app, you are free to implement them (and PR).

## 2.3. Removed TimeSkew

Keycloak JS measures time to resolve token promise. `TimeSkew` is half of that time, estimating time for the request to travel from client to server. Keycloak JS uses `TimeSkew` to reject access token that would otherwise expire during the travel.
While the idea may seem good, it actually makes a little sense:

- Network characteristics vary. The effective `TimeSkew` is based on the characteristics of the previous call. The current call can vary in any way.
- `TimeSkew` reflects response time of Keycloak JS. But what you actually need is response time of the service, which uses the token for authentication/authorization.
  The service is very likely deployed on different server than Keycloak. And/or it calls other services (with the same token) deployed on yet another servers. So you actually need to consider whole tree of services.
  As there are typically many services, and the response time often depends on the input data, the throughout analysis is very difficult (thus makes no sense).

So, AFAIK the best thing you can do to avoid unauthorized service request due to the token expiration is to refresh the token prematurely when it is "close enough" to the expiration. How "close" it should be depends on the application. Basically you need to observe your application responses, under the load ideally, and add some grace period.

## 2.4. Flow is split into two sources

Sometimes, as when you use Keycloak screens for authentication, the first interaction of an unauthenticated user is _outside_ of your application (Keycloak login screen).
In such case, you need to detect that user is not authenticated and redirect him/her to Keycloak as-soon-as-possible to avoid unnecessary resource/service requests and application bootstrap.
Another motivation for fast detection is ability to skip loading of some resources based on the authentication state. For instance, the app may skip loading of login-related resources if authenticated. Or skip other-than-login resources to improve TTFI of the Login screen.

The detection _must_ be fast. The fastest way to execute the check is to run it inside the (inline) `script` element in the `head` of `index.html`. The inline scripts increase the HTML size, and cannot be gzipped.

Keyclops splits the code into two fragments: `bootstrap.js` to be included directly in the `index.html`, and `flows/hybrid.js` to be included as a part of the application resources. And the keyclops instance initialization is split into constructor, and `init()` method.

Please note, that additional care must be taken to transpile `bootstrap.js` to the ES version targeted by your app.

## 2.5. Removed Dynamic Configuration

During bootstrap, Keycloak JS adds the extra request to load configuration, thus effectively torpedoing app bootstrap. If the app needs dynamic configuration, it can load it prior the init call and pass the values in the init config param.

## 2.6. Removed support for Cordova et al.

Your application is either web or hybrid. Keycloak JS has code for both types, so there is always code your application will never use. Keyclops targets web applications, so there is no need to include hybrid stuff.

## 2.7. Other Improvements

- Removed OAuth parameters in query part of URL
  OAuth parameters are passed in the initial URL in the fragment, not the query part of the URL. All query related stuff has been removed.
  Using the fragment is slightly more secure because browsers do not use fragment part when GET -ting initial URL. OAuth parameters stay at the browser.
- Removed support for OAuth2 secret, because there is no way to securely transfer the secret to the (web) client.
- Removed `onLoad` - the login is always performed after initial call to get the refresh token.
- Removed support for registration and related stuff.
- Removed account/user profile related stuff - it should be directly in the app. The implementation adds no functionality, just calls info endpoint.
- Removed User Info related stuff - it should be in the app. The implementation adds no functionality, just calls info endpoint.
- Removed roles related stuff. It is application specific.
- Fixed token decoding - the original implementation uses `atob()` to decode token. Unfortunately, the function does not support UTF-8.
- Single-Sign-Out (SSO) iframe is enabled by default.
  SSO check is no longer called during init or update. Iframe loading is delayed in order not to mess with loading of critical resources.
- Externalized token expiration detection.
- Externalized token storage strategy.
- Uses native Promises. Uses Axios as an HTTP client.
- Removed `callbackStorage`. It is internal abstraction over `localStorage`/cookie. Because it is internal, and the `sessionStorage` is more appropriate, Keyclops uses it directly.

# 3. Other Challenges

## 3.1. How to access protected resources via link

Many server-side (services) and client-side (applications) frameworks assume that the access token is forwarded from application to the service in the service request as an HTTP header. This works most of the times until you try to _link_ a service generated resource. This resource can be an image of the chart in a pretty report, or the Contractual documentation (PDF) suitable for printing. The problematic HTML tags include `a`, `iframe`, `object`. When the user clicks the anchor, or the iframe loads, there is no way to intercept the request and inject the access token header. There are some options how to deal with the issue:

- Adding the token as a query parameter effectively destroys caching. It also requires extra code on client _and_ server side.
- Doing a background XHR and setting `src` to base64 data URL wastes memory.
- Setting the custom `Access-Token` cookie requires extra code on client _and_ server side.

Although not optimal, I usually go for the third option.

## 3.2. Time Difference between Application and Keycloak

The token (and its expiration time) is generated on the Keycloak server. The token update/invalidation is performed on the client (application), based on the token expiration time. This expiration time _is not_ relative to the token creation, but rather absolute - number of seconds since 1.1.1970. This implies that the time on the client and the server _must_ be in synch.
If not, infinite loop (keycloak login → application → keycloak logout), or unauthorized service requests result.
Giving the server is usually properly set, the common cause is the misconfiguration of the client. For instance, manual daylight saving adjustments not being performed, or the local time few minutes out, with the time-server adjustments off.
This can be detected, or even compensated automatically by the application, based on the `iat` claim.

## 3.3. SPA in multiple tabs

SPA stands for Single Page Application. So the "multi tab SPA" is kind of oxymoron. But sometimes, even though meant to be run in a single page, some applications are required to run in multiple tabs/windows.
A real world example is a CRM app where a user can search for, and display detail of the customer. The requirement is to open detail of various customer contracts in the separate tabs _without_ the need to re-authenticate (Single Sign-On, SSO).

If the application _does not implement_ its own login screens but rather uses Keycloak screens, the best approach is to redirect unauthenticated user to Keycloak, let the Keycloak handle SSO, and issue the tokens. From the application point of view the case is the same as when the user comes from the Keycloak login screen.
If the application _does implement_ its own login screens, the authentication state needs to be shared between the tabs/windows. The state usually includes tokens (access, refresh...), and can be shared using domain cookies, or `localStorage`.

Ability to open another page without re-authentication is first part of the job. The other part is to ensure, that interaction in one tab somehow propagates to the other tabs. Otherwise the background tabs would time-out, and sign the user out. After that, the app in the foreground tab would detect the sign-out and logout the user even in the middle of the interaction. In a way, it is about "spreading" _Record Interaction_ flow from the [chapter 2.1. Token update pattern](#21-token-update-pattern) across multiple tabs.
The tabs in the browser are pretty much isolated. Even if they share origin or `document.domain`, they don't share `sessionStorage`. They can, however, share `localStorage` (when shared from same server), and it can be used for stateless messaging.
Following code triggers `storage` event:

```javascript
localStorage.setItem("lastInteraction", `${Date.now()}`);
localStorage.removeItem("lastInteraction");
```

And this is how a handler can look like:

```javascript
window.addEventListener("storage", event => {
  if (event.key === "lastInteraction" && event.newValue) {
    // update local value
    lastInteraction = parseInt(event.newValue);
  }
});
```

Please note, that many aspects of Single Sign-On are application specific. Please read also the next chapter since, the aspects can interfere with the Single Sign-Out process (SSO).

## 3.4. Single Sign-On among multiple apps

If the applications _do not implement_ their own login screens but rather use Keycloak screens, the best approach is to redirect unauthenticated user to Keycloak, let the Keycloak handle SSO, and issue the tokens. From the application point of view the case is the same as when the user comes from the Keycloak login screen.
If the applications _do implement_ their own login screens, the authentication state needs to be shared between the tabs/windows. The state usually includes tokens (access, refresh...), and can be shared using domain cookies. The `localStorage` cannot be shared even if you properly set `document.domain`.

Similarly as in [chapter 3.3. SPA in multiple tabs](#33-spa-in-multiple-tabs), this is just the first step. The second step - ensuring that interaction in one tab somehow propagates to the other tabs - cannot be achieved due to the `same-origin` policy (unless you are willing to use domain cookie for that). As a consequence, if you have several apps open, an app in the background tab can time-out, logout, and trigger Single Sign-out in the current tab, even in the middle of an interaction.

Please note, that in Keycloak, the Single Sign-On is possible only within the same realm.

## 3.5. Single Sign-Out among multiple apps

Please note, that in Keycloak, the Single Sign-Out is possible only within the same realm.

## 3.6. Server-side Session Invalidation

As far as the application has valid tokens, it can make protected service requests, even if the Keycloak is unreachable, or the Keycloak (server-side) session no longer exists.
Even though the tokens are updated properly, the Keycloak session can die for various reasons:

- SSO Session Max time was reached
- User logout performed manually in Keycloak Admin Console
- User logout performed in the background tab, but Single Sign-Out hasn't occurred yet
- Keycloak restart
- Network connectivity (technically, the server session exists, but the token update fails)

The reaction to the situation when tokens cannot be updated is application specific, although usually involves logout.

## 3.7. Avoiding credential re-entering after Keycloak's login timeout

When the Keycloak's login pages are used for authentication process, there is a server-side session associated with the process. This server-side session has limited time to live. If a user opens a login screen, and waits sufficiently to time-out the session, then, after the credential submission, s/he gets the error message, which informs the user the Login timeout has occurred. Even if the submitted credentials are valid, the user is forced to re-enter and re-submit the values.
This can by particularly annoying, if the login screen URL is `redirectUrl` of the logout, and the users log in from the shared computer (as is often the case in the retail shops), where the passwords cannot be saved.

There is a discussion if this "feature" is actually a Keycloak bug. But nevertheless, the workaround is to create dummy "logout" page in Keycloak that just informs the user that s/he has been logged out, with the link to the actual login page. If the user logs out, and the `redirectUrl` points to the logout page, s/he is redirected to logout page. If a new user comes, s/he can click the link and starts new login process _immediately before_ credentials entering.
Even though not perfect, it helps to reduce login timeout occurrence.

# 4. API

## 4.1. Constructor

Creates Keyclops instance. The instance is not fully initialized until `init()` has been called. This "partially" initialized instance can be used to call following methods: `createLoginUrl()` and `createLogoutUrl()`.

**Syntax**

```javascript
new Keyclops(options);
```

**Parameters**

- `options` - Object with the following properties:

  - `url` - Authentication server URL.
  - `realm` - Realm name.
  - `clientId` - Client ID.
  - `sso` - _Optional_. Single Sign-Out configuration object of form:

    ```javascript
    { enabled: true, interval: 5 }
    ```

    Shown default values, both properties are optional.

    - `enabled` if `true` the Check Single Sign-Out flow using embedded iframe is turned on.
    - `interval` - if SSO is enabled, the interval in seconds at which the SSO occurrence is checked.

  - `checkNonce` - _Optional_. Default `false`. Whether to check that nonce in tokens equals to nonce used to start the authentication process. Setting this to `true` makes sense if you can ensure, that the authentication process _cannot_ be started outside of your application.
  - `logging` - _Optional_. Default `false`. Wheter to log various messages to the console.

**Example**

```javascript
const url = "https://accounts.example.org/auth";
const realm = "internal";
const clientId = "sales";

window.keyclops = new Keyclops({ url, realm, clientId });
```

## 4.2. Properties

All the examples in the chapter use fictional JWT token. Their purpose is to demonstrate that `*Token` properties contain _encoded_ JWT token while `*TokenPayload` properties contain _decoded payload_ of the corresponding JWT token.

The real-world tokens will certainly contain additional claims.

### 4.2.1. accessToken

Access Token (JWT), encoded.

**Example**

```javascript
console.log("Access Token:", keyclops.accessToken);
// Access Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

### 4.2.2. accessTokenPayload

Access Token payload, decoded.

**Example**

```javascript
console.log("Access Token payload:", keyclops.tokenPayload);
// Access Token payload:
// {
//  "sub": "1234567890",
//  "name": "John Doe",
//  "iat": 1516239022
// }
```

### 4.2.3. idToken

ID Token (JWT), encoded.

**Example**

```javascript
console.log("ID Token:", keyclops.idToken);
// ID Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

### 4.2.4. idTokenPayload

ID Token payload, decoded.

**Example**

```javascript
console.log("ID Token payload:", keyclops.idTokenPayload);
// ID Token payload:
// {
//  "sub": "1234567890",
//  "name": "John Doe",
//  "iat": 1516239022
// }
```

### 4.2.5. refreshToken

Refresh Token (JWT), encoded.

**Example**

```javascript
console.log("Refresh Token:", keyclops.refreshToken);
// Refresh Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

### 4.2.6. refreshTokenPayload

Refresh Token payload, decoded.

**Example**

```javascript
console.log("Refresh Token payload:", keyclops.refreshTokenPayload);
// Refresh Token payload:
// {
//  "sub": "1234567890",
//  "name": "John Doe",
//  "iat": 1516239022
// }
```

## 4.3. Methods

### 4.3.1. createLoginUrl

Creates login URL.

**Syntax**

```javascript
keyclops.createLoginUrl(redirectUrl, responseType);
```

**Parameters**

- `redirectUrl` - URL the user should be redirected to after successful authentication.
- `responseType` - Defines what should be in the response of successful authentication. Space separated list of following values:

  - `code` - Auth code.
  - `id_token` - Encoded ID Token.
  - `token` - Encoded Access Token.

  The combination of values is specific per OIDC flow: standard - `"code"`, implicit - `"id_token token"`, hybrid - `"code id_token token"`. If you don't need ID Token immediately after successful authentication (you do not), use just `"code token"`.
  Please note, that Keyclops does not implement standard, or implicit flow.

**Returns**

Login URL.

**Example**

```javascript
window.keyclops = new Keyclops("https://accounts.example.org/auth", "internal", "sales");

console.log(keyclops.createLoginUrl("https://sales.example.org", "code token"));
// https://accounts.example.org/auth/realms/internal/protocol/openid-connect/auth?client_id=sales&redirect_uri=https%3A%2F%2Faccounts.example.org%2Fauth&state=03d25fba-b77a-4ee6-8b8a-4dbf3d5840ff&response_mode=fragment&response_type=code%20token&scope=openid
```

### 4.3.2. createLogoutUrl

Creates logout URL.

**Syntax**

```javascript
keyclops.createLogoutUrl(redirectUrl);
```

**Parameters**

- `redirectUrl` - URL the user should be redirected to after successful authentication.

**Returns**

Logout URL.

**Example**

```javascript
window.keyclops = new Keyclops("https://accounts.example.org/auth", "internal", "sales");

keyclops.createLogoutUrl("https://sales.example.org/");
// http://accounts.example.org/auth/realms/internal/protocol/openid-connect/logout?redirect_uri=https%3A%2F%2Fsales.example.org
```

### 4.3.3. init

Finishes initialization of keyclops instance. The method either continues authentication process, or initializes authentication state from existing tokens.

**Syntax**

```javascript
keyclops.init(options);
```

**Parameters**

- `options` - Object with the following properties:
  - `accessToken` - Access Token
  - `idToken` - ID Token
  - `refreshToken` - Refresh Token

**Returns**

`Promise` which is either resolved if authenticated or rejected otherwise.

**Example**

```javascript
const accessToken = getCookie("Access-Token");
const idToken = sessionStorage.getItem("Id-Token");
const refreshToken = sessionStorage.getItem("Refresh-Token");

keyclops
  .init({ accessToken, idToken, refreshToken })
  .then(() => {
    console.log("Authenticated, tokens:", keyclops.accessToken, keyclops.idToken, keyclops.refreshToken);
  ).catch(reason => {
    console.log("Authentication failed", reason);
  });
```

### 4.3.4. update

Updates existing tokens. Usually called in Token Update flow, before the access token expiration.

**Syntax**

```javascript
keyclops.update();
```

**Parameters**

_None_.

**Returns**

`Promise` which is either resolved if the tokens has been updated, or rejected otherwise.

**Example**

```javascript

keyclops
  .update()
  .then(() => {
    console.log("New tokens:", keyclops.accessToken, keyclops.idToken, keyclops.refreshToken);
  ).catch(reason => {
    console.log("Token updated failed", reason);
  });
```

### 4.3.5. clear

Clears tokens.

**Syntax**

```javascript
keyclops.clear();
```

**Parameters**

_None_.

**Example**

```javascript
console.log("Access Token:", keyclops.accessToken);
// Access Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

keyclops.clear();

console.log("Access Token:", keyclops.accessToken);
// Access Token: null
```

### 4.3.6. set

Sets the tokens, and decodes the payloads.

**Syntax**

```javascript
keyclops.set(accessToken, refreshToken, idToken);
```

**Parameters**

- `accessToken` - Access Token.
- `refreshToken` - Refresn Token.
- `idToken` - Id Token.

**Example**

```javascript
keyclops.clear();

console.log("Access Token:", keyclops.accessToken);
// Access Token: null

const accessToken = getCookie("Access-Token");
const idToken = sessionStorage.getItem("Id-Token");
const refreshToken = sessionStorage.getItem("Refresh-Token");

keyclops.set(accessToken, idToken, refreshToken);

console.log("Access Token:", keyclops.accessToken, keyclops.accessTokenPayload);
// Access Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
// {
//  "sub": "1234567890",
//  "name": "John Doe",
//  "iat": 1516239022
// }
```

## 4.4. Life-cycle events

### 4.4.1. onSingleSignOut

Callback function which is called when Single Sign-Out occurs.

**Syntax**

```javascript
keyclops.onSingleSignOut = functionRef;
```

**Value**

`functionRef` is a function name or a function expression. The function receives a `String` as its sole argument.

**Example**

```javascript
keyclops.onSingleSignOut = reason => {
  console.log("onSingleSignOut", reason);
};
```

# 5. Putting things together

Keyclops comes with the test application, which demonstrates a way the Keyclops can be used. It is not included in the npm module. You have to clone the repository first:

```bash
git clone https://github.com/marosivanco/keyclops.git
```

The application assumes following URL space layout:

- www.example.org - the test app
- accounts.example.org - the Keycloak instance

You need to install [Keycloak](https://www.keycloak.org/) instance.

## 5.1. Keycloak Admin Configuration

Go to Keycloak home page and click "Administration Console":
![Home Screen](./doc/keycloak/1.Auth.png)
Login as admin:
![Login](./doc/keycloak/2.Login.png)
Create realm `internal`, go to "Realm Settings", and select "Tokens" tab:
![Realm Token Configuration](./doc/keycloak/3.Realm-Tokens.png)
Set the various times and timeouts. Make sure you set "SSO Session Idle" time, which corresponds to refresh token expiration time, and "Access Token Lifespan".

Then, create a client and open its settings:
![Client Settings](./doc/keycloak/4.Clients-Settings.png)
Make sure you set "Access Type" to public, enable Standard and Implicit flows, and set "Valid Redirect URIs" and "Web Origins".

Please note, that "\*" (asterisk) in "Valid Redirect URIs" and "Web Origins" is _unsuitable_ for production environment.

The last step is to add a user to the realm:
![Add user](./doc/keycloak/5.Users.png)

## 5.2. Run the test application

Go to the directory where you cloned the keyclops and run:

```bash
npm install
```

It should install all the necessary dependencies.

After successful install, serve the test application locally:

```bash
npm run serve
```

The command opens web server on port `80`.

Modify your `etc/hosts` in the way that the name `www.example.org` is mapped to loopback:

```
127.0.0.1	www.example.org
```

In browser, go to www.example.org. You should be redirected to accounts.example.org (Keycloak).
Log in. You should be redirected back to the application, but this time you should see the protected page:
![Keyclops Test App](./doc/test-app.png)

## 5.3. Inside the Test App

The following chapters describe the key aspects of the test application.

### 5.3.1. Bootstrap

```javascript
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
  // store minified scripts for use in html template
  args[0].inline = [bootstrap.code || bootstrap.error, cloak.code || cloak.error, keyclops.code || keyclops.error];
```

_(See [vue.config.js](./vue.config.js), chainWebpack.)_

- `bootstrap.js` - A file you take _as-is_ from `keyclops` module.
- `cloak.js` - Implements company/project-wide strategy for token storage, redirection - based on the security requirements, desired functionality, and URL space layout.
  If you use the same strategy for multiple apps, this file would end up in a common project as a shared component.
  The strategy in this example stores access token in the cookie, refresh token in the `sessionStorage`. Moreover, if app URL is `www.example.org`, it assumes the Keycloak is located at `accounts.example.org`.
- `keyclops.js` - Application-specific, sets the `realm` and `clientId`, often statically, but can be possibly selected dynamically, based on some conditions (e.g. domain name).

...and the HTML template fragment, which inlines defined scripts:

```html
...
  <title>Keyclops test</title>
  <script>
    <%const inline = htmlWebpackPlugin.options.inline;
    for (var i = 0; i < inline.length; i++) {
      %><%= inline[i] %><%
    }%>
  </script>
</head>
...
```

_(See [test/index.html](./test/index.html).)_

### 5.3.2. Application Initialization

**onLoad handler**
Keyclops test detects and redirects unauthenticated user as fast as possible - during the application bootstrap. So when the bootstrap has finished, and `document.onload` has been called, the user is certainly authenticated. `onload` is the time, when JS frameworks, such as Vuex, initialize themselves. Vuex is a reactive store for Vue. The test app uses vuex session module for encapsulation of authentication state (access token payload), token update, and logout actions. The following fragment shows session module registration and onload initialization:

```javascript
...
const store = new Vuex.Store({
  modules: {
    // register module
    session: session.module,
  },
});
// trigger onload initialization
session.onLoad(store.commit, store.dispatch);
export default store;
```

_(See [test/store/index.js](./test/store/index.js).)_

The onload listener restores authentication state from cookie and `sessionStorage`, and finishes Keyclops instance initialization (`init`). If successful, authentication and internal states get updated, some flows are scheduled, Single Sign-Out listener registered. If the initialization fails, the user is logged out:

```javascript
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
```

_(See [test/store/session.js](./test/store/session.js).)_

The _Token Update_ flow in the `handleTokenUpdate` checks the token validity. If invalid, logs the user out. Otherwise the token update is scheduled:

```javascript
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
```

_(See [test/store/session.js](./test/store/session.js), `handleTokenUpdate`.)_

Interesting stuff is the flow scheduling, triggered by `handleTokenUpdate`, in the `onLogin` function. The function implements flows from the [chapter 2.1. Token update pattern](#21-token-update-pattern):

- _Record Interactions_ flow (with `lastInteraction` update propagated across tabs).
- _Check Interactions_ flow

```javascript
function onLogin(dispatch) {
  console.log("[SESSION] onLogin");
  // Record Interactions
  let timeoutId;
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
```

_(See [test/store/session.js](./test/store/session.js).)_

The function registers listener (`updateInteraction`) for various events on the `documentElement`. The listener updates shared variable `lastInteraction`. The variable is subsequently used in the _Check Interactions_ flow. Because some DOM events (`mousemove`) are emitted at high speed, the update is _debounced_.

The function also implements inter-tab communication as described in chapter [3.3 SPA in multiple tabs](#33-spa-in-multiple-tabs). Listener `updateInteraction` also emits `localStorage` `storage` event with last interaction time for other tabs. And the function also registers `storage` listener, which listens to `storage` events with the last interaction time from other tabs.

The check itself just computes user's inactivity and either logs him/her out, or schedules next check:

```javascript
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
```

_(See [test/store/session.js](./test/store/session.js).)_

The vuex module definition is fairly simple. The state just contains access token payload, and two actions: `logout`, and `updateAccessToken`

# 6. Acknowledgement

When I started using Keycloak JS, I soon realized I was running into many issues related to the responsiveness. I was not familiar with OAuth and OIDC. I looked under the hood of the Keycloak JS and dived into it. It is then, I realized the issues stem from the Keycloak JS design, and I need to create a new library.
Even though you probably wouldn't recognize Keycloak JS when looking into Keyclops sources, I consider it predecessor of Keyclops.

# 7. License

[Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)

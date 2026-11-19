# Kinde JavaScript

The Kinde SDK for JavaScript.

You can also use the JavaScript starter kit [here](https://github.com/kinde-starter-kits/javascript-starter-kit).

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://makeapullrequest.com) [![Kinde Docs](https://img.shields.io/badge/Kinde-Docs-eee?style=flat-square)](https://kinde.com/docs/developer-tools/javascript-sdk) [![Kinde Community](https://img.shields.io/badge/Kinde-Community-eee?style=flat-square)](https://thekindecommunity.slack.com)

## Documentation

Please refer to the Kinde [Javacript SDK document](https://kinde.com/docs/developer-tools/javascript-sdk).

## Upgrade notes

- `getToken()` is deprecated and may return `undefined` with the new auth flow.
- Use `getAccessToken()` instead.

## Step-up authentication

Ask Kinde for a stronger or more recent sign-in before a sensitive action. Kinde collects only the missing factor. `acr: "mfa"` means a second factor was used. It does not mean the two factors are independent. `phr` is the stronger value (a passkey, with the user verified by the device) and it satisfies a requirement for `mfa`.

```js
await client.login({acrValues: 'mfa', maxAge: 300});

await client.stepUp({acr: 'mfa', maxAge: 300});

const context = await client.getAuthenticationContext();
const recentMfa = await client.hasAuthenticationContext({
  acr: 'mfa',
  maxAge: 300
});
const supported = await client.isStepUpSupported();
```

`stepUp` is an interactive login. It never sends `prompt=none`. When the business domain does not advertise `acr_values_supported`, `stepUp({acr})` throws, and `stepUp({maxAge})` sends `prompt=login` instead.

`login` and `register` accept the same `acrValues` (`"mfa"`, `"phr"`, or a list) and `maxAge` (seconds, `0` allowed). Omit them to leave the authorization URL unchanged.

A callback error is passed to `on_error_callback`. `createKindeClient()` still resolves, so the app keeps the client. Do not start another login after `unmet_authentication_requirements`. Show the reason and stop. For example, "add a passkey to continue".

```js
await createKindeClient({
  domain,
  redirect_uri,
  on_error_callback(props) {
    if (props.error === 'unmet_authentication_requirements') {
      console.error(props.errorDescription);
    }
  }
});
```

`props.oauthError` is an `UnmetAuthenticationRequirementsError` or `LoginRequiredError`, with `errorDescription` and `state`. `login_required` is left for the app to decide whether an interactive login should start.

After a successful step-up the new access token, ID token, and refresh token replace the stored ones. Refreshing does not raise the authentication context. `getAuthenticationContext()` reads `auth_time` from the ID token. Client checks are for UI. A resource server must check a verified token itself.

## Publishing

The core team handles publishing.

To publish a new package version, use the “Release and Publish to NPM” action in the “Actions” tab.

## Contributing

Please refer to Kinde’s [contributing guidelines](https://github.com/kinde-oss/.github/blob/489e2ca9c3307c2b2e098a885e22f2239116394a/CONTRIBUTING.md).

## License

By contributing to Kinde, you agree that your contributions will be licensed under its MIT License.

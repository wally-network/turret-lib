# turret-controller

[![build status](https://img.shields.io/travis/com/hacksur/turret-controller.svg)](https://travis-ci.com/hacksur/turret-controller)
[![code coverage](https://img.shields.io/codecov/c/github/hacksur/turret-controller.svg)](https://codecov.io/gh/hacksur/turret-controller)
[![code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![made with lass](https://img.shields.io/badge/made_with-lass-95CC28.svg)](https://lass.js.org)
[![license](https://img.shields.io/github/license/hacksur/turret-controller.svg)](LICENSE)
[![npm downloads](https://img.shields.io/npm/dt/turret-controller.svg)](https://npm.im/turret-controller)

> Stellar turret Wrangler implementation in typescript


## Development

- Copy your wrangler.toml from stellar-turret/wrangler
- Replace stellar.toml file with yours
- Run development

```sh
npm run dev
```
## Production

```sh
wrangler publish
```

## Endpoints

```sh
http://localhost:8787/details
```

```sh
http://localhost:8787/toml
```

```sh
http://localhost:8787/tx-fees
```
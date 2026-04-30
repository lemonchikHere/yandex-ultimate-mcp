# 🚀 Автовход и получение ключей/токенов

> Основной язык — русский. English notes are included at the end.

## TL;DR

```bash
npm run auth
npm run doctor
npm run start
```

Wizard теперь browser-assisted:

1. Поднимает локальный callback server.
2. Сам открывает OAuth app page.
3. Ты можешь добавить Redirect URI, который показан в терминале, например:

```text
http://127.0.0.1:17893/callback
```

4. Ты вставляешь `ClientID`.
5. Wizard спрашивает: добавлен ли локальный Redirect URI в OAuth app?
   - если **да** — открывает authorize URL с `redirect_uri=http://127.0.0.1:17893/callback` и ловит token сам;
   - если **нет** или OAuth app уже использует другой callback — открывает authorize URL **без** `redirect_uri`, а ты вставляешь итоговый callback URL из адресной строки.
6. Если видишь `400 redirect_uri не совпадает`, значит в app не добавлен localhost callback: перезапусти wizard и ответь **нет** на вопрос про Redirect URI, либо добавь точный URI в настройках OAuth app.

Token раскладывается по `YANDEX_TOKEN`, `YANDEX_METRIKA_TOKEN`, `YANDEX_DIRECT_TOKEN`, `YANDEX_WEBMASTER_OAUTH_TOKEN`, `YANDEX_TRACKER_TOKEN`.

`YANDEX_CLIENT_LOGIN` — это **не токен**, а логин клиента/аккаунта в Yandex Direct.

> ⚠️ Если token утек в чат/логи — отзови его и выпусти новый.

Без открытия браузера:

```bash
ULTIMATE_NO_OPEN=1 npm run auth
```

## Главная идея

Gateway сам не получает доступ к вашим аккаунтам. Он читает ENV-переменные и передает их соответствующим child MCP. Секреты не коммитьте: используйте `.env.local`, настройки MCP-клиента или secret manager.

```bash
cp .env.example .env.local
npm run auth
npm run doctor
```

## OAuth token

1. Откройте Yandex OAuth app page: https://oauth.yandex.ru/client/new
2. Создайте приложение.
3. Выберите permissions/scopes нужных сервисов.
4. Получите token по URL, который wizard откроет сам:

```text
https://oauth.yandex.ru/authorize?response_type=token&client_id=YOUR_CLIENT_ID
```

## Metrika

Официальная документация: https://yandex.ru/dev/metrika/en/intro/authorization

ENV:

```bash
YANDEX_METRIKA_TOKEN=...
# или универсально
YANDEX_TOKEN=...
```

## Direct + Wordstat

Официальная документация по регистрации/доступу Direct API: https://yandex.ru/dev/direct/doc/en/concepts/register

ENV:

```bash
YANDEX_DIRECT_TOKEN=...
YANDEX_CLIENT_LOGIN=client-login-if-needed
YANDEX_USE_SANDBOX=0
# или универсально
YANDEX_TOKEN=...
```

## Webmaster

Официальная инструкция OAuth: https://yandex.ru/dev/webmaster/doc/en/tasks/how-to-get-oauth

Обычно отдельный токен не нужен: используй тот же OAuth token, если OAuth app имеет Webmaster permissions.

ENV:

```bash
YANDEX_WEBMASTER_OAUTH_TOKEN=тот_же_access_token
# опционально, чтобы ограничить конкретный host
YANDEX_WEBMASTER_HOST_URL=https://example.com
```

## Tracker

ENV:

```bash
YANDEX_TRACKER_TOKEN=...
YANDEX_TRACKER_ORG_ID=...
```

Org ID обычно берется в настройках организации/Tracker.

## Yandex Cloud + Search

ENV для Cloud MCP:

```bash
YC_OAUTH_TOKEN=...
YC_CLOUD_ID=...
YC_FOLDER_ID=...
```

ENV для Search MCP (`yandex-search-mcp`) — это Yandex Cloud Search API:

```bash
YANDEX_SEARCH_API_KEY=...
YANDEX_FOLDER_ID=...
# alias, можно не заполнять если есть YANDEX_FOLDER_ID
YANDEX_SEARCH_FOLDER_ID=...
```

### Яндекс.Поиск для сайта

Это отдельный продукт, не то же самое что Cloud Search MCP. Документация: https://yandex.ru/dev/site/doc/ru/concepts/access

Маршрут:

1. Открой Кабинет разработчика: https://developer.tech.yandex.ru/services/
2. Нажми `Получить ключ`.
3. В поле `Сервис для подключения` выбери `API Яндекс.Поиска для сайта`.
4. Открой `Мои поиски`: https://site.yandex.ru/
5. Выбери поиск или создай новый.
6. На странице `Выдача в JSON` вставь API-ключ и сохрани.
7. Подожди до часа — изменения вступают в силу не мгновенно.

Ограничение из документации: один ключ Поиска для сайта можно подключить только к одному поиску.

## Maps

ENV:

```bash
YANDEX_MAPS_API_KEY=...
YANDEX_MAPS_STATIC_API_KEY=...
```

## English notes

- Create a Yandex OAuth app at https://oauth.yandex.ru/client/new.
- Open `https://oauth.yandex.ru/authorize?response_type=token&client_id=YOUR_CLIENT_ID` to get an OAuth token.
- Put service-specific tokens/API keys into `.env.local` or your MCP client config.
- Run `yandex-ultimate-mcp doctor` to see which modules are enabled.

## Ошибка 400: redirect_uri не совпадает

Это значит, что authorize URL содержит `redirect_uri`, которого нет в Callback URL приложения. Решение: ответь **нет** на вопрос wizard про localhost Redirect URI или добавь показанный URI в OAuth app.

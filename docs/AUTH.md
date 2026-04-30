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
3. В OAuth app выбирай **Для доступа к API или отладки**.
4. Для официального ручного режима добавь Redirect URI:

```text
https://oauth.yandex.ru/verification_code
```

5. Если хочешь auto-capture, дополнительно добавь Redirect URI, который показан в терминале, например:

```text
http://127.0.0.1:17893/callback
```

6. Ты вставляешь `ClientID`.
7. Wizard спрашивает: добавлен ли локальный Redirect URI в OAuth app?
   - если **да** — открывает authorize URL с `redirect_uri=http://127.0.0.1:17893/callback` и ловит token сам;
   - если **нет** — открывает официальный ручной flow, а ты вставляешь URL вида `https://oauth.yandex.ru/verification_code#access_token=...` или чистый token.
8. Если видишь `400 redirect_uri не совпадает`, значит в app не добавлен выбранный callback: перезапусти wizard и ответь **нет** на вопрос про localhost Redirect URI, либо добавь точный URI в настройках OAuth app.

Token раскладывается по `YANDEX_TOKEN`, `YANDEX_METRIKA_TOKEN`, `YANDEX_DIRECT_TOKEN`, `YANDEX_WEBMASTER_TOKEN` / `YANDEX_WEBMASTER_OAUTH_TOKEN`, `YANDEX_TRACKER_TOKEN`.

`YANDEX_CLIENT_LOGIN` — это **не токен**, а логин клиента/аккаунта в Yandex Direct.

> ⚠️ Если token утек в чат/логи — отзови его и выпусти новый.

Без открытия браузера:

```bash
ULTIMATE_NO_OPEN=1 npm run auth
```

Открывать именно Helium с его cookies:

```bash
ULTIMATE_BROWSER_APP=Helium npm run auth
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
2. Выберите **Для доступа к API или отладки**.
3. Для ручного режима добавьте Redirect URI `https://oauth.yandex.ru/verification_code`.
4. Выберите permissions/scopes нужных сервисов.
5. Получите token по URL, который wizard откроет сам:

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

Для Direct в OAuth app нужен доступ `direct:api`. Кроме токена, Direct API обычно требует отдельную заявку на API-доступ в Direct; wizard открывает страницу заявок.

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
YANDEX_WEBMASTER_TOKEN=тот_же_access_token
YANDEX_WEBMASTER_OAUTH_TOKEN=тот_же_access_token
# опционально, чтобы ограничить конкретный host
YANDEX_WEBMASTER_HOST_URL=https://example.com
```

## Webmaster token / WEBMASTER_TOKEN

Чтобы получить токен для API Яндекс.Вебмастера:

1. Перейди на страницу создания OAuth-приложения: https://oauth.yandex.ru/client/new
2. Придумай название сервиса.
3. Выбери тип приложения **Для доступа к API или отладки**.
4. В поле **Redirect URI** укажи `https://oauth.yandex.ru/verification_code`, а localhost URI из wizard добавляй только для auto-capture.
5. В поле **Доступ к данным** напиши `webmaster`.
6. В появившемся списке выбери **все 3 элемента**.
7. Нажми **Создать приложение**.
8. Скопируй `ClientID`, запусти `npm run auth`, получи OAuth token и сохрани его в `YANDEX_WEBMASTER_TOKEN`.

Если API отвечает `403 ACCESS_FORBIDDEN` / `application scopes: []`, token создан без Webmaster scopes — перевыпусти его после выбора доступов `webmaster`.


## Live Webmaster check

`npm run doctor` проверяет Webmaster token реальным read-only запросом к API:

```text
GET https://api.webmaster.yandex.net/v4/user
Authorization: OAuth <token>
```

Зеленый результат: `valid: /v4/user returned user_id`.

Ошибка `403 ACCESS_FORBIDDEN / application scopes: []` означает, что token есть, но выпущен без Webmaster scopes. Нужно перевыпустить OAuth token после выбора всех 3 доступов `webmaster`.

Отключить live checks можно так:

```bash
ULTIMATE_DOCTOR_LIVE=0 npm run doctor
```

## Tracker

ENV:

```bash
YANDEX_TRACKER_TOKEN=...
YANDEX_TRACKER_ORG_ID=...
```

Org ID обычно берется в настройках организации/Tracker.

## Yandex Cloud + Search

Если установлен и авторизован `yc`, wizard сам подставляет `YC_OAUTH_TOKEN`, `YC_CLOUD_ID`, `YC_FOLDER_ID`, `YANDEX_FOLDER_ID` и `YANDEX_SEARCH_FOLDER_ID` из `yc config list`.

ENV для Cloud MCP:

```bash
YC_OAUTH_TOKEN=...
YANDEX_CLOUD_TOKEN=...
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

Это значит, что authorize URL содержит `redirect_uri`, которого нет в Callback URL приложения. Решение: ответь **нет** на вопрос wizard про localhost Redirect URI и используй `https://oauth.yandex.ru/verification_code`, либо добавь показанный localhost URI в OAuth app.

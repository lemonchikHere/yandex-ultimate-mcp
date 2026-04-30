# Auth / токены для Yandex Ultimate MCP

> Основной язык — русский. English notes are included at the end.

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
4. Получите token по URL:

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

ENV:

```bash
YANDEX_WEBMASTER_OAUTH_TOKEN=...
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

ENV для Search MCP:

```bash
YANDEX_SEARCH_API_KEY=...
YANDEX_SEARCH_FOLDER_ID=...
```

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

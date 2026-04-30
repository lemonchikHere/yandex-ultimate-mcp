# Источники / Sources

Исследованные MCP и решение по включению.

## Включены как child MCP

| Module | Package/repo | License | Reason |
| --- | --- | --- | --- |
| `stegyan` | https://www.npmjs.com/package/@stegyan/yandex-mcp / https://github.com/stegyan/yandex-mcp | MIT | Самый большой найденный pack Direct + Metrika + Wordstat (~125 tools). |
| `webmaster` | https://www.npmjs.com/package/yandex-webmaster-mcp / https://github.com/altrr2/yandex-tools-mcp | MIT | Надежный npm-pack Webmaster (~24 tools). |
| `tracker` | https://www.npmjs.com/package/yandex-tracker-mcp | MIT | Удобный NPM-пакет для Tracker (~21 tools). |
| `cloud` | https://www.npmjs.com/package/yandex-cloud-mcp | MIT | Инфраструктурный Yandex Cloud pack (~31 tools). |
| `maps` | https://www.npmjs.com/package/@theyahia/yandex-maps-mcp | MIT | Maps/geocode/routing/static map (~10 tools). |
| `search` | https://github.com/altrr2/yandex-tools-mcp/tree/main/packages/yandex-search-mcp | MIT | Search bridge. |
| `cloud_docs` | https://www.npmjs.com/package/@doctorai/yandex-cloud-docs-mcp-server | MIT | Optional справочник Yandex Cloud docs; выключен по умолчанию, потому что upstream package может быть нестабилен в stdio. |

## Исследованы, но не стали основой

- https://github.com/atomkraft/yandex-metrika-mcp — хороший Metrika-only сервер, но покрытие меньше, чем у mega-pack.
- https://github.com/altrr2/yandex-tools-mcp/tree/main/packages/yandex-metrika-mcp — компактный Metrika module (~10 tools), покрывается mega-pack.
- https://github.com/altrr2/yandex-tools-mcp/tree/main/packages/yandex-webmaster-mcp — неплохой Webmaster (~24 tools), но `weselow` шире.
- https://github.com/weselow/yandex-webmaster-mcp-server — самый полный найденный Webmaster (~46 tools), но GitHub install через npx сейчас не дает готовый bin/dist; оставлен как кандидат для optional bootstrap.
- https://github.com/theYahia/yandex-webmaster-mcp — маленький Webmaster (~6 tools), полезен как reference, но не основной.
- `@theyahia/yandex-direct-mcp` — Direct-only (~12 tools), покрывается mega-pack.
- `@theyahia/yandex-metrika-mcp` — Metrika-only (~16 tools), покрывается mega-pack.
- `aikts/yandex-tracker-mcp` — богатый Tracker на Python (~34 tools, Apache-2.0); можно добавить отдельным optional backend позже.
- PolyForm/ограничительные лицензии — не копируем и не включаем по умолчанию в MIT gateway.

## Принцип

Проект является gateway/orchestrator. Он не переносит чужой исходный код внутрь репозитория, а запускает upstream MCP как отдельные процессы. Это сохраняет границы лицензий и облегчает обновления.

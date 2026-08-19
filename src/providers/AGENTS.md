# Prayer Time Providers

Factory + Strategy pattern for prayer time data sources. Each provider fetches annual prayer times from an external API.

## FILES

| File                  | Role                                                 |
| --------------------- | ---------------------------------------------------- |
| `BaseProvider.js`     | Abstract base class — defines interface              |
| `ProviderFactory.js`  | Static factory — registration and instantiation      |
| `AladhanProvider.js`  | Aladhan.com API integration                          |
| `MyMasjidProvider.js` | MyMasjid.com API integration                         |
| `errors.js`           | `ProviderConnectionError`, `ProviderValidationError` |
| `index.js`            | Re-exports factory, base class, errors               |

## ADDING A NEW PROVIDER

1. Create `YourProvider.js` extending `BaseProvider`.
2. Implement required methods:
   - `getAnnualTimes(config)` — fetch full year of prayer times, return normalized format.
   - `healthCheck()` — verify API reachability, return `{ healthy: boolean, message: string }`.
3. Register in `ProviderFactory.js`: `ProviderFactory.register('yourProvider', YourProvider)`.
4. Add provider-specific config fields to `schemas.js` if needed.

## BaseProvider INTERFACE

| Method                        | Override? | Purpose                                                            |
| ----------------------------- | --------- | ------------------------------------------------------------------ |
| `getAnnualTimes(config)`      | **MUST**  | Fetch year of prayer times from source                             |
| `healthCheck()`               | **MUST**  | Check source availability                                          |
| `deduplicateRequest(key, fn)` | No        | Shared request deduplication (prevents parallel identical fetches) |

## ERROR TYPES

- `ProviderConnectionError` — Network/API failure. **Triggers failover** to next source in priority list.
- `ProviderValidationError` — Bad config or response format. **No failover** — config issue needs user fix.

## FACTORY USAGE

```javascript
const provider = ProviderFactory.create("aladhan"); // Returns AladhanProvider instance
const classes = ProviderFactory.getRegisteredProviders(); // { aladhan: AladhanProvider, mymasjid: MyMasjidProvider }
```

## CONVENTIONS

- **Normalize output** — All providers must return the same data shape regardless of upstream API format.
- **Error classification matters** — Connection errors trigger failover; validation errors don't.
- **Consumers use ProviderFactory** — Never instantiate providers directly. `prayerTimeService.js` uses the factory.

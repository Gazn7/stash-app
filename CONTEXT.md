# stash — CONTEXT.md

## Cos'è stash
App web mobile-first per **sfide tra amici con soldi in palio** (tipo scommesse sociali).
Tagline: *"Are you in?"*
Lingua UI: italiano. Demo mode con €100 di credito fittizio.

---

## Stack tecnico

| Layer | Tecnologia |
|---|---|
| Frontend | HTML/CSS/JS vanilla — single file (`index.html`) |
| Database | PostgreSQL standard via API Vercel `/api/rest/v1/:table` |
| Realtime | Polling ogni 3 secondi (`setInterval`) |
| Auth | Custom (username + password in chiaro su tabella `users`) |
| Pagamenti | Placeholder Mangopay (non integrato) |
| Font | DM Sans (Google Fonts) + Arial Black per titoli |
| Deploy | Vercel + Postgres esterno standard |

---

## Schema database

Schema SQL versionato in `db/schema.sql`. Richiede `POSTGRES_URL` o `DATABASE_URL`.

### Tabelle

```
users
  uid          text (PK)
  name         text
  username     text
  password     text (plain text — da migliorare)
  balance      numeric  (credito demo, default 100)
  escrow       numeric  (fondi bloccati in sfide attive)
  last_seen    bigint   (timestamp ms)

challenges
  id           text (PK) — attualmente sempre 'current' (una sfida alla volta)
  title        text
  amount       numeric
  challenger_uid / challenger_name
  challenged_uid / challenged_name
  status       text  → 'pending' | 'accepted' | 'resolved'
  timer_start  bigint
  timeout      int   (secondi: 3600 | 43200 | 86400)
  created_at   bigint
  winner_uid   text

challenge_votes
  challenge_id text
  voter_uid    text
  winner_uid   text

groups
  id           text (PK)
  name         text
  icon         text (emoji)
  creator_uid  text
  created_at   bigint

group_members
  group_id     text
  uid          text
  name         text

history
  id           text (PK)
  title        text
  amount       numeric
  challenger_uid / challenger_name
  challenged_uid / challenged_name
  winner_uid   text
  status       text
  created_at   bigint
```

API compatibility layer: `api/rest/v1/[table].js`.

---

## Architettura frontend

Single-page app con navigazione manuale via `go('s-nome-schermata')`.

### Schermate principali (`id` degli elementi `.screen`)
- `s-welcome` — login / registrazione
- `s-terms` — accettazione regole
- `s-home` — lista gruppi + sfida live in evidenza
- `s-create-group` — creazione gruppo
- `s-group-custom` — dettaglio gruppo
- `s-create-challenge` — lancia sfida
- `s-accept` — accetta sfida ricevuta
- `s-vote1v1` — dichiarazione esito 1vs1
- `s-vote-group` — voto del gruppo in caso di conflitto
- `s-winner` — schermata vincitore
- `s-wallet` — saldo + transazioni
- `s-deposit` / `s-withdraw` — flussi pagamento (demo)
- `s-history` — storico sfide + statistiche
- `s-profile` — profilo utente
- `s-settings` — cambio username/password
- `s-amici` — lista amici/utenti

### Variabili globali chiave
```js
MY_UID      // uid utente loggato (da localStorage 'stash_uid_v3')
MY_NAME     // nome utente
MY_USERNAME // username
STATE       // { users:{}, challenge:null, groups:{} }
SEL_CHALLENGED  // { uid, name } — avversario selezionato
CH_TIMEOUT  // secondi timeout sfida (default 3600)
```

### Pattern API backend
```js
supaGet(table, filter)         // GET /api/rest/v1/:table
supaUpsert(table, data)        // POST con upsert server-side
supaPatch(table, filter, data) // PATCH
supaDelete(table, filter)      // DELETE
```

---

## Flusso principale (sfida 1vs1)

1. Utente A crea sfida → `challenges` status `pending`, balance A decrementato, escrow A incrementato
2. Utente B riceve notifica (polling) → accetta → status `accepted`, balance B decrementato, escrow B incrementato
3. Entrambi dichiarano vincitore (`challenge_votes`) → se accordo → `resolveWinner()`
4. Disaccordo → voto del gruppo → maggioranza (≥2 voti) → `resolveWinner()`
5. `resolveWinner(uid)` → vincitore riceve `amount * 2`, escrow azzerato per entrambi, status `resolved`, riga in `history`

---

## Problemi noti / debito tecnico

- [ ] `challenges.id` è sempre `'current'` → una sola sfida attiva alla volta (da estendere con ID univoci)
- [ ] Password salvate in chiaro nel DB
- [ ] RLS Supabase disabilitato (chiunque può leggere/scrivere)
- [ ] La tabella `groups` esiste ma la UI del gruppo è parzialmente mockata (usa `STATE.groups` locale)
- [ ] `authFetch` e `supaFetch` sono due funzioni separate che fanno la stessa cosa
- [ ] Nessun sistema di notifiche push reale (solo polling)
- [ ] Il `drawGroups()` cerca un elemento `#groups-container` che non esiste nell'HTML (bug silenzioso)

---

## Prossimi step (da definire con il team)
- Sfide multiple in parallelo (ID univoci su `challenges`)
- Sicurezza: hash password, abilitare RLS Supabase
- Notifiche push reali (FCM o Supabase Realtime via WebSocket)
- Gestione gruppi completa (ora parzialmente funzionante)
- Integrazione Mangopay reale

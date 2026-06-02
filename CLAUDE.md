# stash — Claude Code Context

## Cos'è questo progetto
App mobile social per sfide tra amici con denaro demo in escrow.
Single-page HTML app hostata su Vercel, database PostgreSQL standard.

## Stack
- **Frontend:** HTML single file (`index.html`) — niente framework, JS vanilla
- **Database:** PostgreSQL standard via API Vercel `/api/rest/v1/:table`
- **Hosting:** Vercel
- **Repository:** `https://github.com/stashappindustries-ux/stash-app`

## Backend
- **API:** `/api/rest/v1/:table` compatibility layer
- **DB env:** `POSTGRES_URL` or `DATABASE_URL`
- **Schema:** `db/schema.sql`
- **Migration:** `npm run db:migrate`

## Tabelle Postgres
| Tabella | Colonne chiave |
|---|---|
| `users` | uid, name, username, password, balance, escrow, last_seen |
| `challenges` | id, title, amount, challenger_uid, challenger_name, challenged_uid, challenged_name, status, timer_start, timeout, winner_uid |
| `challenge_votes` | challenge_id, voter_uid, winner_uid |
| `groups` | id, name, icon, creator_uid, created_at |
| `group_members` | group_id, uid, name |
| `history` | id, title, amount, challenger_uid/name, challenged_uid/name, winner_uid, status, created_at |

## Regole del codice — OBBLIGATORIE
- ❌ **NO arrow functions** (`=>`) — usa `function()` classico
- ❌ **NO backtick** — usa concatenazione con `+`
- ❌ **NO optional chaining** (`?.`) — usa `if(x&&x.y)` 
- ✅ **JS vanilla ES5 puro** — compatibile con tutti i browser mobile
- Prima di ogni commit: verificare 0 arrow functions, 0 backtick nel main script

## Schermate dell'app (id HTML)
`s-welcome` → `s-terms` → `s-home` → `s-create-group` → `s-group-custom` → `s-create-challenge` → `s-success` → `s-accept` → `s-vote1v1` → `s-vote-group` → `s-winner`

Sezioni bottom nav: `s-home` · `s-amici` · `s-wallet` · `s-history` · `s-profile`
Altre: `s-settings` · `s-deposit` · `s-withdraw`

## Funzioni chiave
- `go(id)` — navigazione tra schermate
- `onStateChange()` — aggiorna UI quando STATE cambia
- `pollSupabase()` — polling ogni 3s, aggiorna STATE.users/challenge/groups
- `initFirebase(cb)` — avvia polling (nome legacy da migrazione Firebase)
- `drawHome/drawWallet/drawProfile/drawHistory/drawAmici()` — render sezioni
- `drawChallengeUsers/drawGroupUsers()` — lista utenti selezionabili
- `launchChallenge/acceptChallenge/declare/resolveWinner()` — flow sfide

## Dati di test
- 10 utenti creati: marco_f, giulia_r, luca_b, sara_c, matteo_r, chiara_e, davide_r, alessia_m, federico_c, valentina_g
- Password per tutti: `stash2024`
- 5 gruppi e 30 sfide nel DB

## Workflow deploy
1. Modifica `index.html` / `api/` / `db/schema.sql`
2. `npm run test:e2e:mock`
3. `git add . && git commit -m "messaggio" && git push`
4. Vercel deploy automatico
5. Se schema DB cambia: eseguire `npm run db:migrate` con `POSTGRES_URL`

## Bug noti / pendenti
- Sfida "current" è una sola globale — limite architetturale accettabile per beta
- Password in chiaro nel DB — da migliorare in futuro con hashing
- Notifiche campanella: cache history 30s, su altri dispositivi il badge potrebbe essere in ritardo di max 30s

## Plugin installati

### 🪨 Caveman
Riduce i token di output del ~65% facendo rispondere Claude in stile "uomo delle caverne". Stessa precisione tecnica, meno verbosità.

**Installazione (una tantum):**
```bash
claude plugin marketplace add JuliusBrussee/caveman
claude plugin install caveman@caveman
```
Poi riavvia Claude Code.

**Come usarlo:**
- `/caveman` o "caveman mode" — attiva modalità full (default)
- `/caveman lite` — rimuove solo le parole inutili
- `/caveman ultra` — massima compressione
- "stop caveman" o "normal mode" — torna alla modalità normale
- `/caveman-commit` — commit messages ultra-compressi in formato Conventional Commits
- `/caveman-compress` — comprime il CLAUDE.md stesso per risparmiare token in input

**Quando usarlo:**
- Sessioni lunghe dove vuoi risparmiare token
- Operazioni ripetitive (refactor, debug, commit)
- Non usarlo quando hai bisogno di spiegazioni dettagliate su bug complessi

## Contesto progetto
- Fondatore: Jacopo (Senior PM, Milano)
- Fase: beta chiusa con amici
- Prossimi step: test end-to-end su due dispositivi reali

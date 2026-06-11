# Collection Hub+ — accesso condiviso per il team

## Modalità automatica

| Configurazione | Comportamento |
|---|---|
| **Senza** variabili in `.env.local` | App **locale** come prima (dati nel browser, nessun login) |
| **Con** tutte le variabili configurate | App **cloud** con login e dati condivisi |

La dashboard usa un **database unico** (Supabase) e una **password condivisa** per tutto il team quando la modalità cloud è attiva.

## 1. Crea il database su Supabase

1. Vai su [supabase.com](https://supabase.com) e crea un progetto gratuito
2. Apri **SQL Editor** e incolla il contenuto di `supabase/schema.sql`
3. Esegui lo script

## 2. Variabili d'ambiente

Copia `.env.example` in `.env.local` (in locale) e configura:

| Variabile | Descrizione |
|---|---|
| `DASHBOARD_PASSWORD` | Password che darai a tutti i collaboratori |
| `SESSION_SECRET` | Stringa casuale lunga (es. `openssl rand -base64 32`) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del progetto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chiave **service_role** (solo server, mai nel browser) |

## 3. Sviluppo locale

```bash
npm install
npm run dev
```

Apri `http://localhost:3000` → login con la password di team.

## 4. Pubblica online (Vercel)

1. Carica il progetto su GitHub
2. Importa il repo su [vercel.com](https://vercel.com)
3. Aggiungi le **stesse variabili d'ambiente** nel pannello Vercel
4. Deploy

Otterrai un link tipo `https://collection-hub.vercel.app` da condividere con il team.

## 5. Uso quotidiano

- Tutti usano **lo stesso link** e la **stessa password**
- I dati sono **condivisi** (incassi, spese, impostazioni)
- Le modifiche si sincronizzano automaticamente ogni ~20 secondi
- Pulsante **Esci** per chiudere la sessione sul dispositivo

## 6. Porta i dati dal browser al cloud

Se hai già lavorato in **locale** (dati nel browser):

1. In locale, vai in **Impostazioni** → **Esporta backup JSON**
2. Pubblica l’app online (passi 1–4) e fai login
3. In cloud, **Impostazioni** → **Importa backup JSON**

Tutti i collaboratori vedranno gli stessi dati.

## 7. Uso da mobile

L’app è **responsive**: form incassi/spese, login e filtri funzionano bene su telefono.

| Su mobile | Note |
|---|---|
| **Incassi / Spese** | Ideale per inserire ricavi e costi |
| **Panoramica / Mensile** | KPI e grafici ok; tabelle larghe scrollano in orizzontale |
| **Impostazioni / Import OTA** | Meglio da desktop |

Suggerimento: su telefono usa principalmente le tab **Incassi** e **Spese**.

## Note

- Con accesso unico non si vede *chi* ha inserito una riga (si può aggiungere in futuro)
- Se due persone modificano insieme, vince l'ultimo salvataggio
- Il backup JSON in Impostazioni resta disponibile per export/import
- Pulsanti **Importa dati Excel** e **Svuota transazioni** nell’header: usare con cautela in produzione

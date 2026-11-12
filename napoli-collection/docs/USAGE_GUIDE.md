# 📖 Guida Utilizzo - La Bellezza di Napoli PDF Generator

## 🚀 Quick Start

### Prerequisiti
- Python 3.8+
- pip (Python package manager)

### Installazione

```bash
# Clona il repository
git clone https://github.com/davidenardiello-pixel/collection-hub.git
cd collection-hub

# Passa al branch napoli-collection
git checkout napoli-collection

# Installa le dipendenze
cd napoli-collection/generator
pip install -r requirements.txt
```

---

## 📊 Preparazione Dati

### 1. Struttura JSON

Modifica `data/case-vacanze.json` con i dati delle tue proprietà:

```json
{
  "properties": [
    {
      "id": 1,
      "name": "Nome Proprietà",
      "location": "Località",
      "description": "Descrizione breve (2-3 righe)",
      "long_description": "Descrizione estesa",
      "services": ["Servizio 1", "Servizio 2", "Servizio 3"],
      "rooms": 4,
      "bathrooms": 3,
      "guests": 10,
      "price_per_night": "€150-250",
      "price_per_week": "€900-1500",
      "contact_name": "Nome Proprietario",
      "contact_phone": "+39 081 234567",
      "contact_email": "email@example.it",
      "address": "Via Esempio 123",
      "coordinates": {
        "latitude": 40.7509,
        "longitude": 14.4365
      },
      "images": ["immagine1.jpg", "immagine2.jpg"],
      "check_in": "15:00",
      "check_out": "11:00",
      "minimum_stay": 3
    }
  ]
}
```

### 2. Organizzazione Immagini

Crea una cartella `images/` nella root:

```
napoli-collection/
├── images/
│   ├── villa-vesuvio-1.jpg
│   ├── villa-vesuvio-2.jpg
│   ├── casa-mare-1.jpg
│   └── ...
```

**Requisiti immagini:**
- Formato: JPG, PNG
- Risoluzione: Min 1200x800px (consigliato 1600x1000px)
- DPI: 300 DPI per stampa
- Dimensione file: < 5MB

### 3. Preparazione CSV (Alternativa)

Se preferisci un CSV, usa questo formato:

```csv
name,location,description,services,rooms,bathrooms,guests,price_per_night,contact_phone,contact_email
Villa Vesuvio,Pompei,Splendida villa...,WiFi|Piscina|Cucina,4,3,10,€150-250,+39 081 234567,info@example.it
```

---

## 🔧 Utilizzo Generator

### Comando Base

```bash
python pdf_generator.py
```

### Opzioni Avanzate

```bash
# Genera brochure per una singola proprietà
python pdf_generator.py --property-id 1

# Specifica file dati personalizzato
python pdf_generator.py --data-file data/custom.json

# Specifica cartella output
python pdf_generator.py --output-dir /path/to/output

# Modalità verbose (debug)
python pdf_generator.py --verbose
```

---

## 📄 Output

I PDF verranno generati in `output/`:

```
output/
├── brochure_villa_vesuvio.pdf
├── brochure_casa_del_mare.pdf
└── ...
```

### Caratteristiche PDF
- ✅ A4 verticale
- ✅ 2 pagine (fronte-retro)
- ✅ Colori Napoli Collection
- ✅ Pronto per stampa (300 DPI)
- ✅ Testo selezionabile

---

## 🎨 Personalizzazione

### Modificare i Colori

Apri `generator/pdf_generator.py` e modifica il dizionario `COLORS`:

```python
COLORS = {
    'rosso_vesuvio': colors.HexColor('#C1272D'),
    'blu_mediterraneo': colors.HexColor('#003DA5'),
    # ... modifica come desideri
}
```

### Modificare il Layout

Nella classe `NapoliBrochureGenerator`, modifica il metodo `build_property_section()` per aggiungere/rimuovere sezioni.

### Aggiungere Elementi Grafici

Puoi aggiungere:
- Logo personalizzato
- Icone napoletane
- Pattern decorativi
- Watermark

---

## 🐛 Troubleshooting

### "Modulo non trovato"
```bash
pip install -r requirements.txt
```

### "Immagine non trovata"
- Verifica il percorso in `data/case-vacanze.json`
- Assicurati che le immagini siano nella cartella `images/`
- Controlla l'estensione file (.jpg vs .JPG)

### "PDF corrotto o di bassa qualità"
- Aumenta la risoluzione immagini (almeno 1200x800)
- Verifica che le immagini non siano compresse
- Usa JPG con qualità 85-95%

### "Errore encoding"
Assicurati di salvare i file JSON/CSV in UTF-8:
```bash
# Linux/Mac
iconv -f CP1252 -t UTF-8 file.csv > file_utf8.csv

# Windows (PowerShell)
Get-Content file.csv | Out-File -Encoding UTF8 file_utf8.csv
```

---

## 📞 Support

Contatta: support@labellezzadinapoli.it

# 🏰 La Bellezza di Napoli Collection

Brochure PDF professionali e automatizzate per case vacanze napoletane.

## 📋 Struttura Progetto

```
napoli-collection/
├── logo/                          # Brand assets
│   ├── logo-bellezza-napoli.png
│   ├── logo-bellezza-napoli.svg
│   └── color-palette.md
├── brochure-template/             # Template e design
│   ├── template.py
│   └── styles.css
├── data/                          # Informazioni case vacanze
│   ├── case-vacanze.json
│   └── case-vacanze.csv
├── output/                        # PDF generati
│   └── .gitkeep
├── generator/                     # Script generatore
│   ├── pdf_generator.py
│   ├── requirements.txt
│   └── README.md
└── docs/                          # Documentazione
    ├── BRAND_GUIDELINES.md
    └── USAGE_GUIDE.md
```

## 🎨 Brand Identity: La Bellezza di Napoli

### Colori
- **Rosso Vesuvio**: #C1272D
- **Blu Mediterraneo**: #003DA5
- **Oro Napoletano**: #D4AF37
- **Nero Elegante**: #1a1a1a
- **Terracotta**: #B8860B

### Stile
- Elegante e sofisticato
- Elementi napoletani autentici
- Design accattivante e professionale
- Pronto per la stampa

## 🚀 Quick Start

1. Prepara i dati delle tue case in `data/case-vacanze.json`
2. Aggiungi foto nella cartella `images/`
3. Esegui il generatore:
   ```bash
   cd generator
   python pdf_generator.py
   ```
4. I PDF verranno creati in `output/`

## 📄 Formato Brochure

- **Dimensioni**: A4 verticale
- **Pagine**: 2 pagine (fronte-retro)
- **Contiene**: Foto, descrizione, servizi, prezzi, mappa, contatti

## 👤 Autore
Creato da @davidenardiello-pixel

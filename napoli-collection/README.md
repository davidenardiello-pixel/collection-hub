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
2. Aggiungi foto nella cartella `images/` e collega i nomi file nel JSON (`images`, `hero_image`)
3. Esegui il generatore:
   ```bash
   cd napoli-collection/generator
   pip install -r requirements.txt
   python pdf_generator.py
   ```
4. I PDF verranno creati in `output/`

### Opzioni utili

```bash
# Solo una proprietà
python pdf_generator.py --property-id 1

# Include anche proprietà inactive (esempi senza foto)
python pdf_generator.py --include-inactive
```

## 📄 Formato Brochure

- **Dimensioni**: A4 verticale
- **Pagine**: 2 pagine (fronte-retro)
- **Contiene**: Brand header, hero photo, descrizione, highlight, gallery, servizi, dintorni, contatti

## Proprietà attive

| ID | Nome | Foto |
|----|------|------|
| 1 | Elegante Appartamento Vico Pontecorvo | 16 immagini in `images/daniele-vico-pontecorvo-*.jpeg` |

## 👤 Autore
Creato da @davidenardiello-pixel

# 🚀 PDF Generator Module

Modulo Python per generare brochure PDF professionali per "La Bellezza di Napoli Collection".

## 📦 Struttura

```
generator/
├── pdf_generator.py    # Script principale
├── requirements.txt    # Dipendenze Python
└── README.md          # Questo file
```

## 🔧 Installazione

```bash
pip install -r requirements.txt
```

## 💻 Utilizzo

```bash
# Dalla cartella generator/
python pdf_generator.py

# Solo una proprietà
python pdf_generator.py --property-id 1

# Percorsi personalizzati
python pdf_generator.py --data-file ../data/case-vacanze.json --output-dir ../output
```

I path di default puntano a `napoli-collection/data`, `images` e `output`.

## 📚 Documentazione Completa

Vedi `/docs/USAGE_GUIDE.md` per:
- Setup completo
- Preparazione dati
- Personalizzazione layout
- Troubleshooting

## 🎨 Configurazione Branding

Colori e stili sono definiti in `pdf_generator.py`:

```python
COLORS = {
    'rosso_vesuvio': colors.HexColor('#C1272D'),
    'blu_mediterraneo': colors.HexColor('#003DA5'),
    'oro_napoletano': colors.HexColor('#D4AF37'),
    # ...
}
```

Consulta `/docs/BRAND_GUIDELINES.md` per linee guida complete.

## 📋 Dipendenze

- **reportlab**: PDF generation
- **Pillow**: Image processing
- **weasyprint**: HTML to PDF (alternativo)
- **jinja2**: Template rendering
- **python-json-logger**: Logging

## 🐛 Errori Comuni

Vedi `/docs/USAGE_GUIDE.md` sezione "Troubleshooting"

## 📞 Support

Contatta: support@labellezzadinapoli.it

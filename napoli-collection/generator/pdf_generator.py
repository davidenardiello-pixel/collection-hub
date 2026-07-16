#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
La Bellezza di Napoli - PDF Brochure Generator
Genera brochure PDF professionali per case vacanze napoletane
"""

import os
import json
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, Table, TableStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from PIL import Image as PILImage
from datetime import datetime

# ==================== COLORI NAPOLI ====================
COLORS = {
    'rosso_vesuvio': colors.HexColor('#C1272D'),
    'blu_mediterraneo': colors.HexColor('#003DA5'),
    'oro_napoletano': colors.HexColor('#D4AF37'),
    'nero_elegante': colors.HexColor('#1a1a1a'),
    'terracotta': colors.HexColor('#B8860B'),
    'crema_classica': colors.HexColor('#F5F5DC'),
    'verde_limone': colors.HexColor('#CDDC39'),
    'arancio_napoletano': colors.HexColor('#FF8C00'),
}

# ==================== CONFIGURAZIONE ====================
class BrochureConfig:
    PAGE_SIZE = A4
    MARGIN_TOP = 1.5 * cm
    MARGIN_BOTTOM = 1.5 * cm
    MARGIN_LEFT = 1.5 * cm
    MARGIN_RIGHT = 1.5 * cm
    PAGE_WIDTH = A4[0]
    PAGE_HEIGHT = A4[1]
    CONTENT_WIDTH = PAGE_WIDTH - (MARGIN_LEFT + MARGIN_RIGHT)

# ==================== STILI ====================
def get_styles():
    styles = getSampleStyleSheet()
    
    # Titolo principale
    styles.add(ParagraphStyle(
        name='TitleMain',
        parent=styles['Heading1'],
        fontSize=32,
        textColor=COLORS['rosso_vesuvio'],
        spaceAfter=6,
        fontName='Helvetica-Bold',
        alignment=TA_CENTER,
    ))
    
    # Sottotitolo
    styles.add(ParagraphStyle(
        name='Subtitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=COLORS['blu_mediterraneo'],
        spaceAfter=12,
        fontName='Helvetica',
        alignment=TA_CENTER,
    ))
    
    # Tagline/Claim
    styles.add(ParagraphStyle(
        name='Tagline',
        parent=styles['Normal'],
        fontSize=11,
        textColor=COLORS['oro_napoletano'],
        spaceAfter=8,
        fontName='Helvetica-Oblique',
        alignment=TA_CENTER,
    ))
    
    # Heading sezioni
    styles.add(ParagraphStyle(
        name='SectionHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=COLORS['nero_elegante'],
        spaceAfter=10,
        spaceBefore=10,
        fontName='Helvetica-Bold',
        borderColor=COLORS['oro_napoletano'],
        borderWidth=2,
        borderPadding=8,
    ))
    
    # Corpo testo
    styles.add(ParagraphStyle(
        name='BodyText',
        parent=styles['Normal'],
        fontSize=10,
        textColor=COLORS['nero_elegante'],
        spaceAfter=8,
        leading=14,
        alignment=TA_JUSTIFY,
    ))
    
    # Piccolo testo (info)
    styles.add(ParagraphStyle(
        name='SmallText',
        parent=styles['Normal'],
        fontSize=8,
        textColor=COLORS['terracotta'],
        spaceAfter=4,
    ))
    
    return styles

# ==================== GENERATORE ====================
class NapoliBrochureGenerator:
    def __init__(self, config=None):
        self.config = config or BrochureConfig()
        self.styles = get_styles()
        self.output_dir = Path('output')
        self.output_dir.mkdir(exist_ok=True)
    
    def load_property_data(self, data_file):
        """Carica i dati delle proprietà da JSON"""
        with open(data_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def resize_image(self, image_path, max_width=15*cm, max_height=10*cm):
        """Ridimensiona immagine mantenendo proporzioni"""
        try:
            img = PILImage.open(image_path)
            img.thumbnail((max_width/cm*72, max_height/cm*72), PILImage.Resampling.LANCZOS)
            return img
        except Exception as e:
            print(f"Errore nel caricare immagine {image_path}: {e}")
            return None
    
    def build_header(self):
        """Crea l'header della brochure"""
        elements = []
        
        # Titolo principale
        title = Paragraph("La Bellezza di Napoli", self.styles['TitleMain'])
        elements.append(title)
        
        # Tagline
        tagline = Paragraph("Collection", self.styles['Tagline'])
        elements.append(tagline)
        
        # Linea decorativa
        elements.append(Spacer(1, 0.3*cm))
        
        return elements
    
    def build_property_section(self, property_data, image_paths):
        """Crea la sezione di una proprietà"""
        elements = []
        
        # Nome proprietà
        name_para = Paragraph(property_data['name'], self.styles['TitleMain'])
        elements.append(name_para)
        elements.append(Spacer(1, 0.5*cm))
        
        # Immagine principale
        if image_paths and len(image_paths) > 0:
            try:
                img = Image(image_paths[0], width=self.config.CONTENT_WIDTH, height=8*cm)
                elements.append(img)
                elements.append(Spacer(1, 0.5*cm))
            except Exception as e:
                print(f"Errore nell'inserire immagine: {e}")
        
        # Descrizione
        if 'description' in property_data:
            desc = Paragraph(property_data['description'], self.styles['BodyText'])
            elements.append(desc)
            elements.append(Spacer(1, 0.5*cm))
        
        # Servizi
        if 'services' in property_data:
            services_title = Paragraph("✨ Servizi & Amenities", self.styles['SectionHeading'])
            elements.append(services_title)
            services_text = Paragraph(", ".join(property_data['services']), self.styles['BodyText'])
            elements.append(services_text)
            elements.append(Spacer(1, 0.5*cm))
        
        # Info contatti e prezzi
        if 'contact' in property_data or 'price' in property_data:
            info_data = []
            if 'price' in property_data:
                info_data.append(['💰 Prezzo:', property_data['price']])
            if 'contact' in property_data:
                info_data.append(['📞 Contatti:', property_data['contact']])
            
            if info_data:
                info_table = Table(info_data, colWidths=[3*cm, self.config.CONTENT_WIDTH - 3*cm])
                info_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, -1), COLORS['oro_napoletano']),
                    ('TEXTCOLOR', (0, 0), (-1, -1), COLORS['nero_elegante']),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 1, COLORS['blu_mediterraneo']),
                ]))
                elements.append(info_table)
        
        return elements
    
    def generate_brochure(self, property_data, image_paths, output_filename):
        """Genera il PDF della brochure"""
        output_path = self.output_dir / output_filename
        
        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=self.config.PAGE_SIZE,
            rightMargin=self.config.MARGIN_RIGHT,
            leftMargin=self.config.MARGIN_LEFT,
            topMargin=self.config.MARGIN_TOP,
            bottomMargin=self.config.MARGIN_BOTTOM,
        )
        
        # Elementi della brochure
        elements = []
        elements.extend(self.build_header())
        elements.append(Spacer(1, 1*cm))
        elements.extend(self.build_property_section(property_data, image_paths))
        
        # Footer
        elements.append(Spacer(1, 0.8*cm))
        footer_text = Paragraph(
            f"<b>La Bellezza di Napoli</b> | Brochure generata il {datetime.now().strftime('%d/%m/%Y')}",
            self.styles['SmallText']
        )
        elements.append(footer_text)
        
        # Costruisci il PDF
        doc.build(elements)
        print(f"✅ Brochure generata: {output_path}")
        return output_path

# ==================== MAIN ====================
def main():
    # Carica i dati (esempio)
    sample_data = {
        'properties': [
            {
                'name': 'Villa Vesuvio',
                'description': 'Splendida villa con vista panoramica sul Golfo di Napoli. Perfetta per famiglie e gruppi, offre comfort e lusso in uno dei luoghi più affascinanti della Campania.',
                'services': ['WiFi', 'Piscina', 'Cucina', 'Giardino', 'Parcheggio'],
                'price': '€150-250 per notte',
                'contact': 'info@villavesuivo.it | +39 081 234567'
            }
        ]
    }
    
    # Crea il generatore
    generator = NapoliBrochureGenerator()
    
    # Genera brochure per ogni proprietà
    for i, prop in enumerate(sample_data['properties'], 1):
        # Usa immagini di placeholder se non disponibili
        image_paths = []
        if os.path.exists('images'):
            image_paths = [f for f in Path('images').glob('*.jpg') or Path('images').glob('*.png')]
        
        output_name = f"brochure_{prop['name'].replace(' ', '_').lower()}.pdf"
        generator.generate_brochure(prop, image_paths[:1], output_name)

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
La Bellezza di Napoli — PDF Brochure Generator
Genera brochure A4 fronte-retro professionali per le case vacanze.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# ==================== PATHS ====================
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA = ROOT / "data" / "case-vacanze.json"
DEFAULT_IMAGES = ROOT / "images"
DEFAULT_OUTPUT = ROOT / "output"
DEFAULT_LOGO = ROOT / "logo" / "logo-mark.png"

# ==================== COLORS ====================
COLORS = {
    "rosso": colors.HexColor("#C1272D"),
    "blu": colors.HexColor("#003DA5"),
    "oro": colors.HexColor("#D4AF37"),
    "nero": colors.HexColor("#1A1A1A"),
    "antracite": colors.HexColor("#2C2C2C"),
    "terracotta": colors.HexColor("#8B6914"),
    "crema": colors.HexColor("#F7F3E8"),
    "bianco": colors.HexColor("#FFFFFF"),
    "grigio": colors.HexColor("#5A5A5A"),
    "linea": colors.HexColor("#D4AF37"),
}


def register_fonts() -> dict[str, str]:
    """Register available system fonts; fall back to Helvetica family."""
    mapping = {
        "title": "Helvetica-Bold",
        "body": "Helvetica",
        "body_bold": "Helvetica-Bold",
        "italic": "Helvetica-Oblique",
    }
    candidates = [
        (
            "DejaVuSans",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
        ),
        (
            "LiberationSans",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
        ),
    ]
    for family, regular, bold, italic in candidates:
        if Path(regular).exists() and Path(bold).exists():
            try:
                pdfmetrics.registerFont(TTFont(f"{family}", regular))
                pdfmetrics.registerFont(TTFont(f"{family}-Bold", bold))
                if Path(italic).exists():
                    pdfmetrics.registerFont(TTFont(f"{family}-Oblique", italic))
                    mapping["italic"] = f"{family}-Oblique"
                mapping["title"] = f"{family}-Bold"
                mapping["body"] = family
                mapping["body_bold"] = f"{family}-Bold"
                break
            except Exception:
                continue
    return mapping


FONTS = register_fonts()


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE)
    value = re.sub(r"[-\s]+", "_", value)
    return value[:80] or "brochure"


def wrap_text(c: canvas.Canvas, text: str, font: str, size: float, max_width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if c.stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_rounded_rect(c: canvas.Canvas, x, y, w, h, radius=6, fill=None, stroke=None, stroke_width=1):
    c.saveState()
    if fill:
        c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(stroke_width)
    c.roundRect(x, y, w, h, radius, fill=1 if fill else 0, stroke=1 if stroke else 0)
    c.restoreState()


def fit_image(path: Path, max_w: float, max_h: float) -> tuple[float, float]:
    with PILImage.open(path) as im:
        iw, ih = im.size
    ratio = min(max_w / iw, max_h / ih)
    return iw * ratio, ih * ratio


def cover_image(path: Path, target_w: float, target_h: float, cache_dir: Path) -> Path:
    """Crop/resize image to cover a box (object-fit: cover)."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    out = cache_dir / f"{path.stem}_{int(target_w)}x{int(target_h)}.jpg"
    if out.exists():
        return out

    with PILImage.open(path) as im:
        im = im.convert("RGB")
        src_w, src_h = im.size
        target_ratio = target_w / target_h
        src_ratio = src_w / src_h
        if src_ratio > target_ratio:
            new_w = int(src_h * target_ratio)
            left = (src_w - new_w) // 2
            im = im.crop((left, 0, left + new_w, src_h))
        else:
            new_h = int(src_w / target_ratio)
            top = (src_h - new_h) // 2
            im = im.crop((0, top, src_w, top + new_h))
        # ~220 DPI equivalent for A4 print quality feel
        px_w = max(1200, int(target_w / 72 * 220))
        px_h = max(800, int(target_h / 72 * 220))
        im = im.resize((px_w, px_h), PILImage.Resampling.LANCZOS)
        im.save(out, "JPEG", quality=90, optimize=True)
    return out


class NapoliBrochureGenerator:
    def __init__(
        self,
        data_file: Path = DEFAULT_DATA,
        images_dir: Path = DEFAULT_IMAGES,
        output_dir: Path = DEFAULT_OUTPUT,
        logo_path: Path = DEFAULT_LOGO,
    ):
        self.data_file = Path(data_file)
        self.images_dir = Path(images_dir)
        self.output_dir = Path(output_dir)
        self.logo_path = Path(logo_path)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir = self.output_dir / ".cache"
        self.page_w, self.page_h = A4
        self.m = 1.4 * cm

    def load_data(self) -> dict:
        with open(self.data_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def resolve_images(self, prop: dict) -> list[Path]:
        names = []
        hero = prop.get("hero_image")
        if hero:
            names.append(hero)
        for name in prop.get("images", []):
            if name not in names:
                names.append(name)
        paths = []
        for name in names:
            path = self.images_dir / name
            if path.exists():
                paths.append(path)
        return paths

    def draw_gold_line(self, c: canvas.Canvas, x1, y, x2, width=1.2):
        c.setStrokeColor(COLORS["oro"])
        c.setLineWidth(width)
        c.line(x1, y, x2, y)

    def draw_header_band(self, c: canvas.Canvas, brand: dict):
        band_h = 2.2 * cm
        c.setFillColor(COLORS["nero"])
        c.rect(0, self.page_h - band_h, self.page_w, band_h, fill=1, stroke=0)
        c.setStrokeColor(COLORS["oro"])
        c.setLineWidth(2)
        c.line(0, self.page_h - band_h, self.page_w, self.page_h - band_h)

        logo_x = self.m
        text_x = self.m
        if self.logo_path.exists():
            logo_size = 1.5 * cm
            c.drawImage(
                str(self.logo_path),
                logo_x,
                self.page_h - band_h + 0.35 * cm,
                width=logo_size,
                height=logo_size,
                mask="auto",
                preserveAspectRatio=True,
            )
            text_x = logo_x + logo_size + 0.35 * cm

        c.setFillColor(COLORS["oro"])
        c.setFont(FONTS["title"], 13)
        c.drawString(text_x, self.page_h - 1.0 * cm, brand.get("name", "La Bellezza di Napoli"))
        c.setFont(FONTS["body"], 8)
        c.setFillColor(colors.HexColor("#C8C8C8"))
        c.drawString(
            text_x,
            self.page_h - 1.55 * cm,
            f"{brand.get('collection', 'Collection')}  ·  {brand.get('tagline', '')}",
        )

    def draw_footer(self, c: canvas.Canvas, brand: dict, page_label: str):
        y = 0.7 * cm
        self.draw_gold_line(c, self.m, 1.15 * cm, self.page_w - self.m, width=0.8)
        c.setFont(FONTS["body"], 7)
        c.setFillColor(COLORS["grigio"])
        left = f"{brand.get('name', 'La Bellezza di Napoli')}  ·  {datetime.now().strftime('%Y')}"
        c.drawString(self.m, y, left)
        c.drawRightString(self.page_w - self.m, y, page_label)

    def draw_fact_chips(self, c: canvas.Canvas, prop: dict, y: float) -> float:
        def plural(n, singular, plural_form):
            try:
                value = int(n)
            except (TypeError, ValueError):
                return f"{n} {plural_form}"
            return f"{value} {singular if value == 1 else plural_form}"

        chips = [
            plural(prop.get("guests", "—"), "ospite", "ospiti"),
            plural(prop.get("rooms", "—"), "camera", "camere"),
            plural(prop.get("beds", "—"), "letto", "letti"),
            plural(prop.get("bathrooms", "—"), "bagno", "bagni"),
        ]
        gap = 0.25 * cm
        chip_h = 0.85 * cm
        total_w = self.page_w - 2 * self.m
        chip_w = (total_w - gap * (len(chips) - 1)) / len(chips)
        x = self.m
        for chip in chips:
            draw_rounded_rect(
                c, x, y - chip_h, chip_w, chip_h,
                radius=4, fill=COLORS["crema"], stroke=COLORS["oro"], stroke_width=0.8,
            )
            c.setFillColor(COLORS["nero"])
            c.setFont(FONTS["body_bold"], 9)
            c.drawCentredString(x + chip_w / 2, y - chip_h + 0.28 * cm, chip)
            x += chip_w + gap
        return y - chip_h - 0.45 * cm

    def draw_page_one(self, c: canvas.Canvas, prop: dict, brand: dict, images: list[Path]):
        self.draw_header_band(c, brand)
        y = self.page_h - 2.7 * cm

        # Title block
        c.setFillColor(COLORS["rosso"])
        c.setFont(FONTS["title"], 20)
        title_lines = wrap_text(c, prop["name"], FONTS["title"], 20, self.page_w - 2 * self.m)
        for line in title_lines[:2]:
            c.drawString(self.m, y, line)
            y -= 0.75 * cm

        subtitle = prop.get("subtitle") or prop.get("location", "")
        c.setFillColor(COLORS["blu"])
        c.setFont(FONTS["italic"], 11)
        c.drawString(self.m, y, subtitle)
        y -= 0.25 * cm
        self.draw_gold_line(c, self.m, y, self.m + 4.5 * cm, width=1.5)
        y -= 0.45 * cm

        # Hero image
        hero_h = 11.2 * cm
        hero_w = self.page_w - 2 * self.m
        if images:
            hero = cover_image(images[0], hero_w, hero_h, self.cache_dir)
            c.drawImage(str(hero), self.m, y - hero_h, width=hero_w, height=hero_h)
            # thin gold frame
            c.setStrokeColor(COLORS["oro"])
            c.setLineWidth(1.2)
            c.rect(self.m, y - hero_h, hero_w, hero_h, fill=0, stroke=1)
        else:
            draw_rounded_rect(
                c, self.m, y - hero_h, hero_w, hero_h,
                radius=0, fill=COLORS["crema"], stroke=COLORS["oro"],
            )
            c.setFillColor(COLORS["grigio"])
            c.setFont(FONTS["body"], 10)
            c.drawCentredString(self.page_w / 2, y - hero_h / 2, "Immagine non disponibile")
        y -= hero_h + 0.55 * cm

        # Description
        c.setFillColor(COLORS["nero"])
        c.setFont(FONTS["body"], 10)
        desc = prop.get("description") or prop.get("long_description", "")
        for line in wrap_text(c, desc, FONTS["body"], 10, self.page_w - 2 * self.m)[:6]:
            c.drawString(self.m, y, line)
            y -= 0.42 * cm
        y -= 0.25 * cm

        y = self.draw_fact_chips(c, prop, y)

        # Highlights strip
        highlights = prop.get("highlight_services") or prop.get("services", [])[:6]
        if highlights:
            c.setFillColor(COLORS["antracite"])
            strip_h = 1.7 * cm
            c.rect(0, y - strip_h, self.page_w, strip_h, fill=1, stroke=0)
            c.setFillColor(COLORS["oro"])
            c.setFont(FONTS["body_bold"], 8)
            c.drawString(self.m, y - 0.55 * cm, "HIGHLIGHTS")
            c.setFillColor(COLORS["bianco"])
            c.setFont(FONTS["body"], 9)
            c.drawString(self.m, y - 1.15 * cm, "  ·  ".join(highlights[:6]))
            y -= strip_h + 0.35 * cm

        # CTA / price
        price = prop.get("price_per_night", "Su richiesta")
        draw_rounded_rect(
            c, self.m, 1.5 * cm, self.page_w - 2 * self.m, 1.5 * cm,
            radius=5, fill=COLORS["rosso"], stroke=None,
        )
        c.setFillColor(COLORS["bianco"])
        c.setFont(FONTS["body_bold"], 11)
        c.drawString(self.m + 0.45 * cm, 2.35 * cm, "Prenota il tuo soggiorno")
        c.setFont(FONTS["body"], 9)
        c.drawString(self.m + 0.45 * cm, 1.85 * cm, f"Tariffa: {price}  ·  Check-in {prop.get('check_in', '15:00')} / Check-out {prop.get('check_out', '11:00')}")
        phone = prop.get("contact_phone") or brand.get("phone", "")
        if phone:
            c.setFont(FONTS["body_bold"], 10)
            c.drawRightString(self.page_w - self.m - 0.45 * cm, 2.1 * cm, phone)

        self.draw_footer(c, brand, "1 / 2")

    def draw_page_two(self, c: canvas.Canvas, prop: dict, brand: dict, images: list[Path]):
        self.draw_header_band(c, brand)
        y = self.page_h - 2.75 * cm

        c.setFillColor(COLORS["rosso"])
        c.setFont(FONTS["title"], 16)
        c.drawString(self.m, y, "Scopri lo spazio")
        y -= 0.2 * cm
        self.draw_gold_line(c, self.m, y, self.m + 3.2 * cm)
        y -= 0.4 * cm

        # Gallery 2x2
        gallery = images[1:5] if len(images) > 1 else images[:1]
        gap = 0.3 * cm
        cell_w = (self.page_w - 2 * self.m - gap) / 2
        cell_h = 5.4 * cm
        for idx, img_path in enumerate(gallery[:4]):
            col = idx % 2
            row = idx // 2
            x = self.m + col * (cell_w + gap)
            iy = y - (row + 1) * cell_h - row * gap
            fitted = cover_image(img_path, cell_w, cell_h, self.cache_dir)
            c.drawImage(str(fitted), x, iy, width=cell_w, height=cell_h)
            c.setStrokeColor(COLORS["oro"])
            c.setLineWidth(0.8)
            c.rect(x, iy, cell_w, cell_h, fill=0, stroke=1)

        rows = max(1, (min(4, len(gallery)) + 1) // 2)
        y -= rows * cell_h + (rows - 1) * gap + 0.55 * cm

        # Two columns: services + nearby
        col_gap = 0.5 * cm
        col_w = (self.page_w - 2 * self.m - col_gap) / 2
        left_x = self.m
        right_x = self.m + col_w + col_gap
        section_top = y

        # Services
        c.setFillColor(COLORS["blu"])
        c.setFont(FONTS["title"], 12)
        c.drawString(left_x, y, "Servizi")
        y_left = y - 0.35 * cm
        self.draw_gold_line(c, left_x, y_left, left_x + 1.8 * cm, width=1)
        y_left -= 0.45 * cm
        c.setFillColor(COLORS["nero"])
        c.setFont(FONTS["body"], 8.5)
        services = prop.get("services", [])
        for service in services[:12]:
            c.drawString(left_x, y_left, f"•  {service}")
            y_left -= 0.38 * cm

        # Nearby
        y_right = section_top
        c.setFillColor(COLORS["blu"])
        c.setFont(FONTS["title"], 12)
        c.drawString(right_x, y_right, "Nei dintorni")
        y_right -= 0.35 * cm
        self.draw_gold_line(c, right_x, y_right, right_x + 2.4 * cm, width=1)
        y_right -= 0.45 * cm
        c.setFillColor(COLORS["nero"])
        c.setFont(FONTS["body"], 8.5)
        for item in prop.get("nearby_attractions", [])[:8]:
            c.drawString(right_x, y_right, f"•  {item}")
            y_right -= 0.38 * cm

        y = min(y_left, y_right) - 0.45 * cm

        # Practical info box
        box_h = 3.4 * cm
        draw_rounded_rect(
            c, self.m, y - box_h, self.page_w - 2 * self.m, box_h,
            radius=6, fill=COLORS["crema"], stroke=COLORS["oro"], stroke_width=1.1,
        )
        pad = 0.4 * cm
        tx = self.m + pad
        ty = y - 0.55 * cm
        c.setFillColor(COLORS["rosso"])
        c.setFont(FONTS["title"], 11)
        c.drawString(tx, ty, "Informazioni pratiche")
        ty -= 0.5 * cm
        c.setFillColor(COLORS["nero"])
        c.setFont(FONTS["body"], 9)
        lines = [
            f"Indirizzo: {prop.get('address', '—')}",
            f"Check-in: {prop.get('check_in', '15:00')}   ·   Check-out: {prop.get('check_out', '11:00')}   ·   Soggiorno minimo: {prop.get('minimum_stay', 1)} notte/i",
            f"Contatto: {prop.get('contact_name', '')}  ·  {prop.get('contact_phone', '')}",
            f"Email: {prop.get('contact_email', '')}",
        ]
        for line in lines:
            for wrapped in wrap_text(c, line, FONTS["body"], 9, self.page_w - 2 * self.m - 2 * pad):
                c.drawString(tx, ty, wrapped)
                ty -= 0.4 * cm

        # Bottom brand strip
        c.setFillColor(COLORS["nero"])
        c.rect(0, 1.4 * cm, self.page_w, 1.1 * cm, fill=1, stroke=0)
        c.setFillColor(COLORS["oro"])
        c.setFont(FONTS["body_bold"], 9)
        c.drawCentredString(
            self.page_w / 2,
            1.8 * cm,
            f"{brand.get('name', 'La Bellezza di Napoli')}  ·  {brand.get('tagline', 'Vivi Napoli, ama Napoli')}",
        )

        self.draw_footer(c, brand, "2 / 2")

    def generate_brochure(self, prop: dict, brand: dict) -> Path | None:
        images = self.resolve_images(prop)
        if not images:
            print(f"⚠️  Nessuna immagine trovata per: {prop.get('name')} — salto.")
            return None

        filename = f"brochure_{slugify(prop['name'])}.pdf"
        output_path = self.output_dir / filename

        c = canvas.Canvas(str(output_path), pagesize=A4)
        c.setTitle(f"{prop['name']} — {brand.get('name', 'La Bellezza di Napoli')}")
        c.setAuthor(brand.get("name", "La Bellezza di Napoli"))
        c.setSubject("Brochure case vacanze Napoli Collection")

        self.draw_page_one(c, prop, brand, images)
        c.showPage()
        self.draw_page_two(c, prop, brand, images)
        c.save()

        print(f"✅ Brochure generata: {output_path}")
        return output_path

    def generate_all(self, property_id: int | None = None, include_inactive: bool = False) -> list[Path]:
        data = self.load_data()
        brand = data.get("brand", {})
        props = data.get("properties", [])
        generated: list[Path] = []

        for prop in props:
            if property_id is not None and prop.get("id") != property_id:
                continue
            if not include_inactive and prop.get("active") is False:
                continue
            path = self.generate_brochure(prop, brand)
            if path:
                generated.append(path)
        return generated


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Genera brochure PDF La Bellezza di Napoli")
    parser.add_argument("--property-id", type=int, default=None, help="Genera solo la proprietà con questo id")
    parser.add_argument("--data-file", type=Path, default=DEFAULT_DATA, help="Percorso al JSON dati")
    parser.add_argument("--images-dir", type=Path, default=DEFAULT_IMAGES, help="Cartella immagini")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT, help="Cartella output PDF")
    parser.add_argument("--include-inactive", action="store_true", help="Include proprietà con active=false")
    parser.add_argument("--verbose", action="store_true", help="Log aggiuntivo")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    generator = NapoliBrochureGenerator(
        data_file=args.data_file,
        images_dir=args.images_dir,
        output_dir=args.output_dir,
    )
    if args.verbose:
        print(f"Data: {generator.data_file}")
        print(f"Images: {generator.images_dir}")
        print(f"Output: {generator.output_dir}")

    results = generator.generate_all(
        property_id=args.property_id,
        include_inactive=args.include_inactive,
    )
    if not results:
        print("Nessuna brochure generata.")
        return 1
    print(f"\nCompletato: {len(results)} brochure in {generator.output_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

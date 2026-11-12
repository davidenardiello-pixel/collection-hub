#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
La Bellezza di Napoli — Premium PDF Brochure Generator
Layout editoriale A4 fronte-retro ad alto impatto grafico.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from PIL import Image as PILImage
from PIL import ImageDraw, ImageEnhance, ImageFilter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# ==================== PATHS ====================
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA = ROOT / "data" / "case-vacanze.json"
DEFAULT_IMAGES = ROOT / "images"
DEFAULT_OUTPUT = ROOT / "output"
FONTS_DIR = ROOT / "fonts"

# ==================== COLORS ====================
C = {
    "rosso": colors.HexColor("#B01E24"),
    "blu": colors.HexColor("#0A2F6B"),
    "oro": colors.HexColor("#C9A227"),
    "oro_chiaro": colors.HexColor("#E2C56A"),
    "nero": colors.HexColor("#0E0E0E"),
    "ink": colors.HexColor("#171717"),
    "crema": colors.HexColor("#F3EEE3"),
    "bianco": colors.HexColor("#FFFFFF"),
    "grigio": colors.HexColor("#6E6A63"),
    "fumo": colors.HexColor("#2A2A2A"),
}


def register_fonts() -> dict[str, str]:
    mapping = {
        "display": "Helvetica-Bold",
        "display_it": "Helvetica-Oblique",
        "sans": "Helvetica",
        "sans_md": "Helvetica",
        "sans_bd": "Helvetica-Bold",
    }
    pairs = [
        ("PlayfairDisplay", "PlayfairDisplay-Regular.ttf"),
        ("PlayfairDisplay-Bold", "PlayfairDisplay-Bold.ttf"),
        ("PlayfairDisplay-Italic", "PlayfairDisplay-Italic.ttf"),
        ("Montserrat", "Montserrat-Regular.ttf"),
        ("Montserrat-Medium", "Montserrat-Medium.ttf"),
        ("Montserrat-SemiBold", "Montserrat-SemiBold.ttf"),
        ("Montserrat-Bold", "Montserrat-Bold.ttf"),
    ]
    registered = {}
    for name, filename in pairs:
        path = FONTS_DIR / filename
        if path.exists():
            try:
                pdfmetrics.registerFont(TTFont(name, str(path)))
                registered[name] = True
            except Exception as exc:
                print(f"Font skip {name}: {exc}")
    if registered.get("PlayfairDisplay-Bold"):
        mapping["display"] = "PlayfairDisplay-Bold"
    if registered.get("PlayfairDisplay-Italic"):
        mapping["display_it"] = "PlayfairDisplay-Italic"
    elif registered.get("PlayfairDisplay"):
        mapping["display_it"] = "PlayfairDisplay"
    if registered.get("Montserrat"):
        mapping["sans"] = "Montserrat"
    if registered.get("Montserrat-Medium"):
        mapping["sans_md"] = "Montserrat-Medium"
    if registered.get("Montserrat-SemiBold"):
        mapping["sans_bd"] = "Montserrat-SemiBold"
    elif registered.get("Montserrat-Bold"):
        mapping["sans_bd"] = "Montserrat-Bold"
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


def cover_crop(im: PILImage.Image, tw: int, th: int) -> PILImage.Image:
    src_w, src_h = im.size
    target_ratio = tw / th
    src_ratio = src_w / src_h
    if src_ratio > target_ratio:
        new_w = int(src_h * target_ratio)
        left = (src_w - new_w) // 2
        im = im.crop((left, 0, left + new_w, src_h))
    else:
        new_h = int(src_w / target_ratio)
        top = max(0, int((src_h - new_h) * 0.35))  # bias slightly upward for interiors
        if top + new_h > src_h:
            top = src_h - new_h
        im = im.crop((0, top, src_w, top + new_h))
    return im.resize((tw, th), PILImage.Resampling.LANCZOS)


def enhance_photo(im: PILImage.Image) -> PILImage.Image:
    im = ImageEnhance.Contrast(im).enhance(1.08)
    im = ImageEnhance.Color(im).enhance(1.06)
    im = ImageEnhance.Sharpness(im).enhance(1.12)
    return im


class NapoliBrochureGenerator:
    def __init__(
        self,
        data_file: Path = DEFAULT_DATA,
        images_dir: Path = DEFAULT_IMAGES,
        output_dir: Path = DEFAULT_OUTPUT,
    ):
        self.data_file = Path(data_file)
        self.images_dir = Path(images_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir = self.output_dir / ".cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.page_w, self.page_h = A4

    def load_data(self) -> dict:
        with open(self.data_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def resolve_images(self, prop: dict) -> list[Path]:
        names: list[str] = []
        hero = prop.get("hero_image")
        if hero:
            names.append(hero)
        for name in prop.get("images", []):
            if name not in names:
                names.append(name)
        return [p for n in names if (p := self.images_dir / n).exists()]

    def prepare_cover(self, image_path: Path) -> Path:
        """Full-bleed cover with cinematic bottom gradient + film grain feel."""
        out = self.cache_dir / f"cover_{image_path.stem}.jpg"
        # Always rebuild for consistent look while iterating designs
        px_w, px_h = 1654, 2339  # ~200 dpi A4
        with PILImage.open(image_path) as im:
            im = enhance_photo(im.convert("RGB"))
            im = cover_crop(im, px_w, px_h)

        overlay = PILImage.new("RGBA", im.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        # Top vignette
        for i in range(220):
            alpha = int(90 * (1 - i / 220))
            draw.line([(0, i), (px_w, i)], fill=(8, 8, 8, alpha))
        # Bottom cinematic wash — smooth, no hard box
        for i in range(1400):
            y = px_h - 1400 + i
            t = i / 1400
            # ease-in curve keeps upper photo open, bottom nearly opaque
            alpha = int(10 + 235 * (t ** 1.55))
            draw.line([(0, y), (px_w, y)], fill=(8, 8, 8, min(alpha, 248)))
        # Soft lower veil (no hard edges)
        for i in range(420):
            y = px_h - 420 + i
            t = i / 420
            alpha = int(40 * t)
            draw.line([(0, y), (px_w, y)], fill=(8, 8, 8, alpha))
        # Side vignette
        for i in range(120):
            alpha = int(50 * (1 - i / 120))
            draw.line([(i, 0), (i, px_h)], fill=(0, 0, 0, alpha))
            draw.line([(px_w - 1 - i, 0), (px_w - 1 - i, px_h)], fill=(0, 0, 0, alpha))

        composed = PILImage.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
        composed = composed.filter(ImageFilter.GaussianBlur(radius=0.35))
        composed.save(out, "JPEG", quality=92, optimize=True)
        return out

    def prepare_panel(self, image_path: Path, w_pt: float, h_pt: float, tag: str) -> Path:
        out = self.cache_dir / f"panel_{image_path.stem}_{tag}.jpg"
        px_w = max(900, int(w_pt / 72 * 200))
        px_h = max(700, int(h_pt / 72 * 200))
        with PILImage.open(image_path) as im:
            im = enhance_photo(im.convert("RGB"))
            im = cover_crop(im, px_w, px_h)
            im.save(out, "JPEG", quality=90, optimize=True)
        return out

    def draw_gold_rule(self, c: canvas.Canvas, x, y, length, weight=1.1):
        c.setStrokeColor(C["oro"])
        c.setLineWidth(weight)
        c.line(x, y, x + length, y)

    def draw_page_one(self, c: canvas.Canvas, prop: dict, brand: dict, images: list[Path]):
        """Full-bleed cinematic cover."""
        cover = self.prepare_cover(images[0])
        c.drawImage(str(cover), 0, 0, width=self.page_w, height=self.page_h)

        # Thin gold frame inset
        inset = 0.45 * cm
        c.setStrokeColor(C["oro"])
        c.setLineWidth(1.1)
        c.setStrokeAlpha(0.9)
        c.rect(inset, inset, self.page_w - 2 * inset, self.page_h - 2 * inset, fill=0, stroke=1)
        c.setStrokeAlpha(1)

        # Vertical brand mark (graphic impact)
        c.saveState()
        c.translate(1.05 * cm, self.page_h / 2)
        c.rotate(90)
        c.setFillColor(C["oro"])
        c.setFont(FONTS["sans_bd"], 8)
        c.drawCentredString(0, 0, "LA BELLEZZA DI NAPOLI  ·  COLLECTION")
        c.restoreState()

        # Brand top
        c.setFillColor(C["oro_chiaro"])
        c.setFont(FONTS["sans_bd"], 9)
        brand_line = brand.get("name", "La Bellezza di Napoli").upper()
        c.drawCentredString(self.page_w / 2, self.page_h - 1.25 * cm, brand_line)
        self.draw_gold_rule(c, self.page_w / 2 - 2.0 * cm, self.page_h - 1.55 * cm, 4.0 * cm, 1.0)
        c.setFillColor(colors.Color(1, 1, 1, alpha=0.88))
        c.setFont(FONTS["sans"], 7.5)
        c.drawCentredString(
            self.page_w / 2,
            self.page_h - 1.95 * cm,
            (brand.get("tagline") or "Vivi Napoli, ama Napoli").upper(),
        )

        # Bottom editorial title block (fixed zone, no overlaps)
        left = 1.35 * cm
        max_w = self.page_w - 2.7 * cm

        # Accent bar
        c.setFillColor(C["rosso"])
        c.rect(left, 6.55 * cm, 1.35 * cm, 0.14 * cm, fill=1, stroke=0)

        c.setFillColor(C["oro"])
        c.setFont(FONTS["sans_bd"], 8.5)
        location = (prop.get("subtitle") or prop.get("location") or "").upper()
        c.drawString(left, 6.0 * cm, location)

        c.setFillColor(C["bianco"])
        c.setFont(FONTS["display"], 34)
        title = prop["name"]
        parts = title.split(" ")
        if len(parts) >= 4:
            title_lines = [" ".join(parts[:2]), " ".join(parts[2:])]
        else:
            title_lines = wrap_text(c, title, FONTS["display"], 34, max_w)[:2]
        y = 5.0 * cm
        for line in title_lines:
            c.drawString(left, y, line)
            y -= 1.15 * cm

        self.draw_gold_rule(c, left, y + 0.4 * cm, 3.6 * cm, 1.8)

        # One short evocative line only
        c.setFillColor(colors.Color(1, 1, 1, alpha=0.94))
        c.setFont(FONTS["display_it"], 12)
        blurb = "Fascino napoletano, comfort moderno e vista che resta impressa."
        by = 2.45 * cm
        for line in wrap_text(c, blurb, FONTS["display_it"], 12, max_w)[:2]:
            c.drawString(left, by, line)
            by -= 0.42 * cm

        # Meta footer
        c.setFillColor(C["bianco"])
        c.setFont(FONTS["sans_md"], 8)
        guests = prop.get("guests", "—")
        rooms = prop.get("rooms", "—")
        baths = prop.get("bathrooms", "—")
        bath_label = "BAGNO" if str(baths) == "1" else "BAGNI"
        meta = f"{guests} OSPITI   ·   {rooms} CAMERE   ·   {baths} {bath_label}"
        c.drawString(left, 1.2 * cm, meta)

        phone = prop.get("contact_phone") or brand.get("phone", "")
        if phone:
            c.setFont(FONTS["sans_bd"], 10)
            c.setFillColor(C["oro_chiaro"])
            c.drawRightString(self.page_w - 1.2 * cm, 1.2 * cm, phone)

    def draw_stat(self, c: canvas.Canvas, x, y, value, label):
        c.setFillColor(C["oro"])
        c.setFont(FONTS["display"], 22)
        c.drawString(x, y, str(value))
        c.setFillColor(C["grigio"])
        c.setFont(FONTS["sans"], 7)
        c.drawString(x, y - 0.35 * cm, label.upper())

    def draw_page_two(self, c: canvas.Canvas, prop: dict, brand: dict, images: list[Path]):
        """Editorial interior: photo architecture + refined type."""
        # Cream ground
        c.setFillColor(C["crema"])
        c.rect(0, 0, self.page_w, self.page_h, fill=1, stroke=0)

        # Left dark vertical panel
        panel_w = 7.6 * cm
        c.setFillColor(C["nero"])
        c.rect(0, 0, panel_w, self.page_h, fill=1, stroke=0)

        # Gold accent edge
        c.setFillColor(C["oro"])
        c.rect(panel_w, 0, 0.08 * cm, self.page_h, fill=1, stroke=0)

        # Left panel content
        x = 0.85 * cm
        y = self.page_h - 1.5 * cm
        c.setFillColor(C["oro"])
        c.setFont(FONTS["sans_bd"], 7.5)
        c.drawString(x, y, brand.get("name", "La Bellezza di Napoli").upper())
        y -= 0.35 * cm
        self.draw_gold_rule(c, x, y, 2.4 * cm, 0.9)

        y -= 1.1 * cm
        c.setFillColor(C["bianco"])
        c.setFont(FONTS["display"], 18)
        for line in wrap_text(c, "Un soggiorno nel cuore di Napoli", FONTS["display"], 18, panel_w - 1.7 * cm):
            c.drawString(x, y, line)
            y -= 0.7 * cm

        y -= 0.35 * cm
        c.setFillColor(colors.Color(1, 1, 1, alpha=0.82))
        c.setFont(FONTS["sans"], 8.2)
        long_desc = prop.get("long_description") or prop.get("description", "")
        for line in wrap_text(c, long_desc, FONTS["sans"], 8.2, panel_w - 1.7 * cm)[:10]:
            c.drawString(x, y, line)
            y -= 0.36 * cm

        # Stats block
        y -= 0.55 * cm
        self.draw_gold_rule(c, x, y, 2.0 * cm, 0.8)
        y -= 1.0 * cm
        gap = 1.7 * cm
        self.draw_stat(c, x, y, prop.get("guests", "—"), "Ospiti")
        self.draw_stat(c, x + gap, y, prop.get("rooms", "—"), "Camere")
        self.draw_stat(c, x + 2 * gap, y, prop.get("beds", "—"), "Letti")

        # Highlights on dark panel
        y -= 1.5 * cm
        c.setFillColor(C["oro"])
        c.setFont(FONTS["sans_bd"], 7.5)
        c.drawString(x, y, "ESSENZIALI")
        y -= 0.45 * cm
        highlights = prop.get("highlight_services") or prop.get("services", [])[:6]
        c.setFillColor(C["bianco"])
        c.setFont(FONTS["sans"], 8)
        for item in highlights[:6]:
            c.setFillColor(C["oro"])
            c.drawString(x, y, "—")
            c.setFillColor(colors.Color(1, 1, 1, alpha=0.9))
            c.drawString(x + 0.35 * cm, y, item)
            y -= 0.4 * cm

        # Contact bottom of dark panel
        c.setFillColor(C["fumo"])
        c.rect(0, 0, panel_w, 3.5 * cm, fill=1, stroke=0)
        c.setFillColor(C["oro"])
        c.setFont(FONTS["sans_bd"], 7)
        c.drawString(x, 2.7 * cm, "PRENOTA")
        c.setFillColor(C["bianco"])
        c.setFont(FONTS["display"], 11)
        phone = prop.get("contact_phone") or brand.get("phone", "")
        c.drawString(x, 2.15 * cm, phone)
        c.setFont(FONTS["sans"], 7.2)
        c.setFillColor(colors.Color(1, 1, 1, alpha=0.75))
        email = prop.get("contact_email") or brand.get("email", "")
        for line in wrap_text(c, email, FONTS["sans"], 7.2, panel_w - 1.6 * cm):
            c.drawString(x, 1.65 * cm, line)
            break
        c.setFont(FONTS["sans"], 6.8)
        addr = prop.get("address", "")
        for i, line in enumerate(wrap_text(c, addr, FONTS["sans"], 6.8, panel_w - 1.6 * cm)[:2]):
            c.drawString(x, 1.15 * cm - i * 0.28 * cm, line)

        # Right side photo architecture
        right_x = panel_w + 0.35 * cm
        right_w = self.page_w - right_x - 0.55 * cm
        top = self.page_h - 0.55 * cm

        # Prefer view shot as large panel, bedroom details as supporting
        by_name = {p.name: p for p in images}
        preferred_big = by_name.get("daniele-vico-pontecorvo-6.jpeg") or by_name.get("daniele-vico-pontecorvo-3.jpeg") or images[min(1, len(images)-1)]
        preferred_s1 = by_name.get("daniele-vico-pontecorvo-2.jpeg") or images[0]
        preferred_s2 = by_name.get("daniele-vico-pontecorvo-10.jpeg") or images[-1]

        # Large hero-like photo
        big_h = 11.8 * cm
        big = self.prepare_panel(preferred_big, right_w, big_h, "big")
        c.drawImage(str(big), right_x, top - big_h, width=right_w, height=big_h)

        # Caption over lower edge of big photo
        c.setFillColor(colors.Color(0, 0, 0, alpha=0.5))
        c.rect(right_x, top - big_h, right_w, 1.05 * cm, fill=1, stroke=0)
        c.setFillColor(C["oro_chiaro"])
        c.setFont(FONTS["sans_bd"], 7)
        c.drawString(right_x + 0.35 * cm, top - big_h + 0.58 * cm, "NAPOLI · CENTRO STORICO")
        c.setFillColor(C["bianco"])
        c.setFont(FONTS["display_it"], 9)
        c.drawString(right_x + 0.35 * cm, top - big_h + 0.22 * cm, "Luce, balcone e skyline mediterraneo")

        # Asymmetric small photos: taller left, shorter right offset
        gap = 0.28 * cm
        small_y = top - big_h - gap
        left_h = 6.5 * cm
        right_h = 5.5 * cm
        small_w = (right_w - gap) / 2
        left_img = self.prepare_panel(preferred_s1, small_w, left_h, "s1")
        right_img = self.prepare_panel(preferred_s2, small_w, right_h, "s2")
        c.drawImage(str(left_img), right_x, small_y - left_h, width=small_w, height=left_h)
        c.drawImage(
            str(right_img),
            right_x + small_w + gap,
            small_y - right_h - 0.5 * cm,
            width=small_w,
            height=right_h,
        )
        # Gold corner accent on right photo
        ax = right_x + small_w + gap
        ay = small_y - right_h - 0.5 * cm
        c.setStrokeColor(C["oro"])
        c.setLineWidth(1.4)
        c.line(ax, ay + right_h, ax + 1.2 * cm, ay + right_h)
        c.line(ax, ay + right_h, ax, ay + right_h - 1.2 * cm)

        # Bottom strip: nearby + services
        strip_top = small_y - left_h - 0.3 * cm
        strip_h = strip_top - 0.55 * cm
        c.setFillColor(C["bianco"])
        c.rect(right_x, 0.55 * cm, right_w, strip_h, fill=1, stroke=0)
        c.setStrokeColor(C["oro"])
        c.setLineWidth(0.8)
        c.line(right_x, 0.55 * cm + strip_h, right_x + right_w, 0.55 * cm + strip_h)

        # Inner content
        tx = right_x + 0.4 * cm
        ty = 0.55 * cm + strip_h - 0.55 * cm
        c.setFillColor(C["rosso"])
        c.setFont(FONTS["sans_bd"], 7.5)
        c.drawString(tx, ty, "NEI DINTORNI")
        ty -= 0.35 * cm
        c.setFillColor(C["ink"])
        c.setFont(FONTS["sans"], 7.3)
        nearby = prop.get("nearby_attractions", [])
        # two columns of nearby
        col_w = (right_w - 0.9 * cm) / 2
        for i, item in enumerate(nearby[:6]):
            col = i % 2
            row = i // 2
            c.drawString(tx + col * col_w, ty - row * 0.32 * cm, f"·  {item}")

        ty -= 1.3 * cm
        self.draw_gold_rule(c, tx, ty, 1.8 * cm, 0.8)
        ty -= 0.4 * cm
        c.setFillColor(C["rosso"])
        c.setFont(FONTS["sans_bd"], 7.5)
        c.drawString(tx, ty, "SERVIZI")
        ty -= 0.32 * cm
        c.setFillColor(C["ink"])
        c.setFont(FONTS["sans"], 7)
        services = ", ".join(prop.get("services", [])[:10])
        for line in wrap_text(c, services, FONTS["sans"], 7, right_w - 0.85 * cm)[:3]:
            c.drawString(tx, ty, line)
            ty -= 0.28 * cm

        # Practical line
        ty -= 0.15 * cm
        c.setFillColor(C["grigio"])
        c.setFont(FONTS["sans"], 6.8)
        practical = (
            f"Check-in {prop.get('check_in', '15:00')}  ·  "
            f"Check-out {prop.get('check_out', '11:00')}  ·  "
            f"Min. {prop.get('minimum_stay', 1)} notte"
        )
        c.drawString(tx, max(0.75 * cm, ty), practical)

    def generate_brochure(self, prop: dict, brand: dict) -> Path | None:
        images = self.resolve_images(prop)
        if not images:
            print(f"⚠️  Nessuna immagine per: {prop.get('name')} — salto.")
            return None

        filename = f"brochure_{slugify(prop['name'])}.pdf"
        output_path = self.output_dir / filename

        c = canvas.Canvas(str(output_path), pagesize=A4)
        c.setTitle(f"{prop['name']} — {brand.get('name', 'La Bellezza di Napoli')}")
        c.setAuthor(brand.get("name", "La Bellezza di Napoli"))
        c.setSubject("Brochure premium Napoli Collection")

        self.draw_page_one(c, prop, brand, images)
        c.showPage()
        self.draw_page_two(c, prop, brand, images)
        c.save()
        print(f"✅ Brochure generata: {output_path}")
        return output_path

    def generate_all(self, property_id: int | None = None, include_inactive: bool = False) -> list[Path]:
        data = self.load_data()
        brand = data.get("brand", {})
        generated: list[Path] = []
        for prop in data.get("properties", []):
            if property_id is not None and prop.get("id") != property_id:
                continue
            if not include_inactive and prop.get("active") is False:
                continue
            path = self.generate_brochure(prop, brand)
            if path:
                generated.append(path)
        return generated


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Genera brochure PDF premium La Bellezza di Napoli")
    parser.add_argument("--property-id", type=int, default=None)
    parser.add_argument("--data-file", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--images-dir", type=Path, default=DEFAULT_IMAGES)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--include-inactive", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    generator = NapoliBrochureGenerator(
        data_file=args.data_file,
        images_dir=args.images_dir,
        output_dir=args.output_dir,
    )
    if args.verbose:
        print(f"Fonts: {FONTS}")
        print(f"Data: {generator.data_file}")
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

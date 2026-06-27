#!/usr/bin/env python3
"""
Anahtarlık 3D Keychain Generator
=====================================================
CadQuery tabanlı düz ve damla formlu çift satırlı anahtarlık üretici.

Kullanım:
  python generator_cq.py --text YONCALI --sub_text MOBILYA --base_shape teardrop --text_scale 80 --text_mode engrave --text_depth 1.5
"""

import cadquery as cq
import argparse
import sys
import math

# ============================================================
# CLI ARGÜMANLARI
# ============================================================

parser = argparse.ArgumentParser(description="3D Anahtarlık Üretici")
parser.add_argument("--text",          type=str,   default="TA4TUN",   help="Anahtarlık metni (1. Satır)")
parser.add_argument("--sub_text",      type=str,   default="",         help="Alt metin (2. Satır)")
parser.add_argument("--sub_text2",     type=str,   default="",         help="İkinci alt metin (3. Satır)")
parser.add_argument("--ampersand",      action="store_true",            help="Ana ve alt metin arasına & ekle")
parser.add_argument("--ampersand2",     action="store_true",            help="Alt metinler arasına & ekle")
parser.add_argument("--font_size",     type=float, default=30.0,       help="Temel yazı boyutu (mm)")
parser.add_argument("--text_scale",    type=float, default=100.0,      help="Yazı boyutu yüzdesi (%)")
parser.add_argument("--text_depth",    type=float, default=2.0,        help="Yazı derinliği (mm)")
parser.add_argument("--italic",        action="store_true",            help="İtalik yazı tipi kullan")
parser.add_argument("--base_shape",    type=str,   default="rectangle",help="Taban şekli: rectangle veya teardrop")
parser.add_argument("--hole_position", type=str,   default="center_left", help="Delik konumu")
parser.add_argument("--base_height",   type=float, default=3.0,        help="Taban plakası yüksekliği (mm)")
parser.add_argument("--chamfer",       type=float, default=1.0,        help="Taban üst kenar pah kırma (mm)")
parser.add_argument("--font",          type=str,   default="DIN Mittelschrift Std",    help="Font adı")
parser.add_argument("--hole_radius",    type=float, default=3.5,        help="Delik yarıçapı (mm)")
parser.add_argument("--hole_thickness", type=float, default=2.5,        help="Halka et kalınlığı (mm)")
parser.add_argument("--output",        type=str,   default="keychain.stl", help="Çıktı dosyası")
args = parser.parse_args()

# ============================================================
# PARAMETRELER
# ============================================================

metin           = args.text
alt_metin       = args.sub_text
alt_metin2      = args.sub_text2
base_font_size  = args.font_size
text_scale      = args.text_scale
text_depth      = args.text_depth
is_italic       = args.italic
base_shape_type = args.base_shape
hole_pos        = args.hole_position
taban_yukseklik = args.base_height
pah_miktari     = args.chamfer
font_adi        = args.font
output_file     = args.output

scale_ratio = text_scale / 100.0
yazi_boyutu = base_font_size * scale_ratio
yazi_kalinlik = text_depth
hole_radius = args.hole_radius
hole_thickness = args.hole_thickness

has_sub_text = len(alt_metin.strip()) > 0
has_sub_text2 = len(alt_metin2.strip()) > 0
has_ampersand = args.ampersand and has_sub_text
has_ampersand2 = args.ampersand2 and has_sub_text and has_sub_text2
line_spacing = yazi_boyutu * 1.3

main_text_w = len(metin) * yazi_boyutu * 0.65
sub_text_w = len(alt_metin) * yazi_boyutu * 0.65 if has_sub_text else 0
sub_text2_w = len(alt_metin2) * yazi_boyutu * 0.65 if has_sub_text2 else 0
ampersand_w = yazi_boyutu * 0.8 * 0.65 if has_ampersand else 0
ampersand2_w = yazi_boyutu * 0.8 * 0.65 if has_ampersand2 else 0

# Set of rows that exist
rows = ["main"]
if has_sub_text:
    if has_ampersand:
        rows.append("amp1")
    rows.append("sub1")
if has_sub_text2:
    if has_ampersand2:
        rows.append("amp2")
    rows.append("sub2")

num_active_rows = len(rows)
total_v_height = (num_active_rows - 1) * line_spacing
start_y = total_v_height / 2

y_positions = {}
for i, r in enumerate(rows):
    y_positions[r] = start_y - i * line_spacing

main_y_offset = y_positions["main"]
ampersand_y_offset = y_positions.get("amp1", 0)
sub_y_offset = y_positions.get("sub1", 0)
ampersand2_y_offset = y_positions.get("amp2", 0)
sub2_y_offset = y_positions.get("sub2", 0)

approx_text_width = max(main_text_w, sub_text_w, sub_text2_w, ampersand_w, ampersand2_w)
approx_text_depth = yazi_boyutu + total_v_height

is_left = 'left' in hole_pos
is_right = 'right' in hole_pos
is_top_middle = 'top_middle' in hole_pos or 'top_center' in hole_pos
is_bottom_middle = 'bottom_middle' in hole_pos or 'bottom_center' in hole_pos

p_left = 24.0 if is_left else 10.0
p_right = 24.0 if is_right else 10.0
p_top = 24.0 if is_top_middle else 12.0
p_bottom = 24.0 if is_bottom_middle else 12.0

approx_width = approx_text_width + p_left + p_right
approx_depth = approx_text_depth + p_top + p_bottom

if base_shape_type == "teardrop":
    approx_width += (10.0 * scale_ratio)

base_center_x = (p_right - p_left) / 2

# ============================================================
# 1. TABAN PLAKASI (Base Plate)
# ============================================================

if base_shape_type == "teardrop":
    r_main = approx_depth / 2
    r_small = hole_radius + hole_thickness
    
    cx_left = -approx_width / 2 + (r_small if is_left else r_main)
    cx_right = approx_width / 2 - (r_main if is_left else r_small)
    
    r_left = r_small if is_left else r_main
    r_right = r_main if is_left else r_small
    
    d = cx_right - cx_left
    theta = math.asin((r_left - r_right) / d)
    
    TL = (cx_left + r_left * math.sin(theta), r_left * math.cos(theta))
    BL = (cx_left + r_left * math.sin(theta), -r_left * math.cos(theta))
    TR = (cx_right + r_right * math.sin(theta), r_right * math.cos(theta))
    BR = (cx_right + r_right * math.sin(theta), -r_right * math.cos(theta))
    
    cyl_left = cq.Workplane("XY").center(cx_left, 0).cylinder(taban_yukseklik, r_left, centered=(True, True, False))
    cyl_right = cq.Workplane("XY").center(cx_right, 0).cylinder(taban_yukseklik, r_right, centered=(True, True, False))
    
    trapezoid = (
        cq.Workplane("XY")
        .polyline([TL, TR, BR, BL])
        .close()
        .extrude(taban_yukseklik)
    )
    
    base = cyl_left.union(cyl_right).union(trapezoid)
    
else:
    base = (
        cq.Workplane("XY")
        .center(base_center_x, 0)
        .box(approx_width, approx_depth, taban_yukseklik, centered=(True, True, False))
    )
    try:
        base = base.edges("|Z").fillet(5)
    except:
        pass

safe_chamfer = min(pah_miktari, (taban_yukseklik / 2) - 0.1)
if safe_chamfer > 0.1:
    try:
        base = base.faces(">Z").edges().chamfer(safe_chamfer)
    except:
        pass

# ============================================================
# 2. DELİK AÇMA (HOLE)
# ============================================================

hole_x = 0
hole_y = 0

if is_left:
    hole_x = -approx_width/2 + hole_radius + 4.5
elif is_right:
    hole_x = approx_width/2 - hole_radius - 4.5

if base_shape_type == "teardrop":
    hole_y = 0
else:
    if 'top' in hole_pos:
        hole_y = approx_depth/2 - hole_radius - 4.5
    elif 'bottom' in hole_pos:
        hole_y = -approx_depth/2 + hole_radius + 4.5
    else:
        hole_y = 0

try:
    hole_cyl = cq.Workplane("XY").center(hole_x + base_center_x, hole_y).cylinder(taban_yukseklik * 3, hole_radius, centered=(True, True, True))
    base = base.cut(hole_cyl)
except Exception as e:
    print(f"[WARN] Delik açılamadı: {e}")

# ============================================================
# 3. METİN PROFİLİ (ÇİFT SATIR)
# ============================================================

if has_ampersand:
    main_y_offset = line_spacing
    ampersand_y_offset = 0
    sub_y_offset = -line_spacing
elif has_sub_text:
    main_y_offset = line_spacing / 2
    sub_y_offset = -line_spacing / 2
else:
    main_y_offset = 0

# Z ekseninde yerleşim
z_pos = taban_yukseklik

try:
    # 1. SATIR
    text_3d = (
        cq.Workplane("XY")
        .translate((base_center_x, main_y_offset, z_pos))
        .text(metin, yazi_boyutu, yazi_kalinlik, font=font_adi, kind="italic" if is_italic else "bold", halign="center", valign="center")
    )
    
    # AMPERSAND
    if has_ampersand:
        amp_size = yazi_boyutu * 0.8
        amp_3d = (
            cq.Workplane("XY")
            .translate((base_center_x, ampersand_y_offset, z_pos))
            .text("&", amp_size, yazi_kalinlik, font=font_adi, kind="italic" if is_italic else "bold", halign="center", valign="center")
        )
        text_3d = text_3d.union(amp_3d)

    # 2. SATIR
    if has_sub_text:
        sub_text_3d = (
            cq.Workplane("XY")
            .translate((base_center_x, sub_y_offset, z_pos))
            .text(alt_metin, yazi_boyutu, yazi_kalinlik, font=font_adi, kind="italic" if is_italic else "bold", halign="center", valign="center")
        )
        text_3d = text_3d.union(sub_text_3d)

    # AMPERSAND 2
    if has_ampersand2:
        amp_size = yazi_boyutu * 0.8
        amp_3d_2 = (
            cq.Workplane("XY")
            .translate((base_center_x, ampersand2_y_offset, z_pos))
            .text("&", amp_size, yazi_kalinlik, font=font_adi, kind="italic" if is_italic else "bold", halign="center", valign="center")
        )
        text_3d = text_3d.union(amp_3d_2)

    # 3. SATIR (Alt Metin 2)
    if has_sub_text2:
        sub_text_3d_2 = (
            cq.Workplane("XY")
            .translate((base_center_x, sub2_y_offset, z_pos))
            .text(alt_metin2, yazi_boyutu, yazi_kalinlik, font=font_adi, kind="italic" if is_italic else "bold", halign="center", valign="center")
        )
        text_3d = text_3d.union(sub_text_3d_2)

except Exception as e:
    print(f"[ERROR] Yazı oluşturulamadı: {e}")
    sys.exit(1)

# ============================================================
# 4. BİRLEŞTİRME & EXPORT
# ============================================================

try:
    final_model = base.union(text_3d)
except Exception as e:
    final_model = cq.Assembly()
    final_model.add(base)
    final_model.add(text_3d)

try:
    cq.exporters.export(final_model, output_file)
    print(f"\n{'='*50}")
    print(f"  ✅ Anahtarlık başarıyla oluşturuldu: {output_file}")
    print(f"  🔲 Şekil: {base_shape_type.upper()}")
    print(f"  📏 Çift Satır: {'Evet' if has_sub_text else 'Hayır'}")
    print(f"  🔎 Yazı Büyüklüğü: %{text_scale}")
    print(f"{'='*50}\n")
except Exception as e:
    print(f"[FATAL] STL export başarısız: {e}")
    sys.exit(1)

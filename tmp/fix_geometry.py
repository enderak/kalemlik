import os

file_path = r'c:\Users\Ender\Documents\isimlik\src\components\organisms\Scene3D.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Part 1: Support Wedge (Lines 82-101 approx)
# We look for the start of the wedge loop logic
start_wedge = -1
end_wedge = -1
for i, line in enumerate(lines):
    if 'const startAngle = tiltAngleRad;' in line:
        start_wedge = i
    if start_wedge != -1 and 'positions.setXYZ(i, xTapered + xShift, yFinal, z + zShift);' in line:
        end_wedge = i + 1
        break

if start_wedge != -1 and end_wedge != -1:
    new_wedge = [
        '                  const startZ = -textDepth - (y * Math.tan(tiltAngleRad));\n',
        '                  const endZ = -supportHeight - (y * Math.tan(tiltAngleRad)); // Taban hizası\n',
        '\n',
        '                  // YANAL GENİŞLEME (Pah Etkisi): Masaya yaklaştıkça yanlara %30 yayıl\n',
        '                  const taperFactor = 1 + (curve * 0.3);\n',
        '                  const xTapered = x * taperFactor;\n',
        '\n',
        '                  // ÇEYREK DAİRE FİLLET (Yükselme Efekti): \n',
        '                  // Harfin sırtıyla (startZ) taban (endZ) arasını kavisli (fillet) bağlar.\n',
        '                  const yFinal = y * Math.cos(curve * Math.PI / 2) + baseH;\n',
        '                  const zShift = startZ + ( (endZ - startZ) * Math.sin(curve * Math.PI / 2) );\n',
        '\n',
        '                  // 3. İtalik (X ekseni kayması)\n',
        '                  const xShift = isItalic ? (y * Math.tan(italicAngleRad)) : 0;\n',
        '\n',
        '                  positions.setXYZ(i, xTapered + xShift, yFinal, zShift);\n'
    ]
    lines[start_wedge:end_wedge] = new_wedge

# Part 2: Main Letter (Lines 140+ approx)
start_main = -1
end_main = -1
for i, line in enumerate(lines):
    if 'ROTASYONEL DÖNÜŞ (Shear yerine Gerçek Rotasyon):' in line:
        start_main = i
    if start_main != -1 and 'positions.setXYZ(i, x + xShift, yFinal, zFinal);' in line:
        end_main = i + 1
        break

if start_main != -1 and end_main != -1:
    # Need to preserve the x, y, z definitions which are before world comment
    # Actually start_main should be the comment
    new_main = [
        '                   // SAF AFFINE SHEAR (Resimdeki gibi üst yüzeyi düz tutar)\n',
        '                   const zShift = - (y * Math.tan(tiltAngleRad)) + z;\n',
        '                   const xShift = isItalic ? (y * Math.tan(italicAngleRad)) : 0;\n',
        '\n',
        '                   positions.setXYZ(i, x + xShift, y, zShift);\n'
    ]
    lines[start_main:end_main] = new_main

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Successfully updated Scene3D.jsx")

import os

file_path = r'c:\Users\Ender\Documents\isimlik\src\components\organisms\Scene3D.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace INSET_AMOUNT = 0.0 with 0.2
if 'const INSET_AMOUNT = 0.0;' in text:
    text = text.replace('const INSET_AMOUNT = 0.0;', 'const INSET_AMOUNT = 0.2;')
    print("Replaced 0.0 with 0.2")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

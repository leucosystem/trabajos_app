"""Convierte los PDFs de pdf-test-output/ a PNG para revisarlos. Requiere: pip install pymupdf"""
import glob
import os

import fitz

for pdf_path in sorted(glob.glob("pdf-test-output/*.pdf")):
    doc = fitz.open(pdf_path)
    base = os.path.splitext(pdf_path)[0]
    print(f"{os.path.basename(pdf_path)}: {len(doc)} páginas")
    for number, page in enumerate(doc, start=1):
        page.get_pixmap(dpi=60).save(f"{base}-p{number}.png")

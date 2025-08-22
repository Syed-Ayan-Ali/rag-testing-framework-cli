#!/usr/bin/env python3
"""
PDF Parser using pypdfium2
Extracts text from PDF files and saves to text files
"""

import sys
import os
import json
import traceback
from pathlib import Path
import pypdfium2 as pdfium

def extract_text_from_pdf(pdf_path: str, output_path: str) -> dict:
    """
    Extract text from PDF using pypdfium2

    Args:
        pdf_path (str): Path to the input PDF file
        output_path (str): Path where to save the extracted text

    Returns:
        dict: Result with success status and metadata
    """
    try:
        # Open the PDF file
        pdf = pdfium.PdfDocument(pdf_path)

        # Get basic PDF information
        info = pdf.get_metadata_dict()
        page_count = len(pdf)

        print(f"Processing PDF: {os.path.basename(pdf_path)}")
        print(f"Pages: {page_count}")

        extracted_text = ""

        # Extract text from each page
        for page_number in range(page_count):
            page = pdf.get_page(page_number)

            # Extract text from the page
            text = page.get_textpage().get_text_range()

            if text.strip():  # Only add non-empty pages
                extracted_text += f"\n=== Page {page_number + 1} ===\n\n"
                extracted_text += text
                extracted_text += "\n"

            page.close()

        pdf.close()

        # Save the extracted text
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(extracted_text)

        return {
            'success': True,
            'pages': page_count,
            'text_length': len(extracted_text),
            'output_path': output_path,
            'metadata': info
        }

    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }

def main():
    if len(sys.argv) != 3:
        print("Usage: python pdf-parser.py <pdf_path> <output_path>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_path = sys.argv[2]

    # Validate input file
    if not os.path.exists(pdf_path):
        print(f"Error: PDF file not found: {pdf_path}")
        sys.exit(1)

    if not pdf_path.lower().endswith('.pdf'):
        print("Error: Input file must be a PDF")
        sys.exit(1)

    # Create output directory if it doesn't exist
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    # Extract text from PDF
    result = extract_text_from_pdf(pdf_path, output_path)

    # Output result as JSON for Node.js to parse
    print(json.dumps(result))

    if not result['success']:
        sys.exit(1)

if __name__ == "__main__":
    main()

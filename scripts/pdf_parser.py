#!/usr/bin/env python3
"""
PDF Parser using pypdfium2
Extracts text from PDF files and saves to text files
"""

import sys
import os
import argparse
from pathlib import Path
import pypdfium2 as pdfium

def parse_pdf(pdf_path: str, output_dir: str = "parsed_output") -> str:
    """
    Parse a PDF file and extract text
    
    Args:
        pdf_path: Path to the PDF file
        output_dir: Directory to save output files
        
    Returns:
        Path to the output text file
    """
    try:
        print(f"Creating output directory: {output_dir}")
        # Create output directory if it doesn't exist
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Get the PDF filename without extension
        pdf_name = Path(pdf_path).stem
        print(f"Processing PDF: {pdf_name}")
        
        print("Opening PDF file...")
        # Open the PDF
        pdf = pdfium.PdfDocument(pdf_path)
        print("PDF opened successfully")
        
        # Extract text from all pages
        text_content = []
        total_pages = len(pdf)
        print(f"Found {total_pages} pages to process")
        
        for page_num in range(total_pages):
            print(f"Processing page {page_num + 1}/{total_pages}...")
            page = pdf.get_page(page_num)
            text_page = page.get_textpage()
            text = text_page.get_text_range()
            text_content.append(f"--- Page {page_num + 1} ---\n{text}\n")
            text_page.close()
            page.close()
            print(f"Page {page_num + 1} completed")
        
        print("Closing PDF file...")
        # Close the PDF
        pdf.close()
        
        # Combine all text
        full_text = "\n".join(text_content)
        print(f"Combined text length: {len(full_text)} characters")
        
        # Save to text file
        output_file = Path(output_dir) / f"{pdf_name}.txt"
        print(f"Saving to: {output_file}")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(full_text)
        
        print("File saved successfully")
        return str(output_file)
        
    except Exception as e:
        print(f"Error parsing PDF: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

def main():
    """Main function to handle command line arguments"""
    try:
        print("Starting PDF parser...")
        
        parser = argparse.ArgumentParser(description='Parse PDF files using pypdfium2')
        parser.add_argument('pdf_path', help='Path to the PDF file to parse')
        parser.add_argument('-o', '--output-dir', default='parsed_output', 
                           help='Output directory for parsed text files (default: parsed_output)')
        
        args = parser.parse_args()
        
        print(f"PDF path: {args.pdf_path}")
        print(f"Output directory: {args.output_dir}")
        print("Arguments parsed successfully")
        
        # Check if PDF file exists
        if not os.path.exists(args.pdf_path):
            print(f"Error: PDF file '{args.pdf_path}' not found", file=sys.stderr)
            sys.exit(1)
        
        print(f"PDF file found: {args.pdf_path}")
        
        # Parse the PDF
        print("Starting PDF parsing...")
        output_file = parse_pdf(args.pdf_path, args.output_dir)
        print(f"PDF parsed successfully. Output saved to: {output_file}")
        
    except Exception as e:
        print(f"Fatal error in main: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

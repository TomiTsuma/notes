import { pdfjs } from 'react-pdf';

export async function extractPdfText(dataUrl: string): Promise<string> {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  let uint8Array: Uint8Array;
  const base64 = dataUrl.split('base64,')[1];
  if (base64) {
    const raw = window.atob(base64);
    uint8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      uint8Array[i] = raw.charCodeAt(i);
    }
  } else {
    const response = await fetch(dataUrl);
    const arrayBuffer = await response.arrayBuffer();
    uint8Array = new Uint8Array(arrayBuffer);
  }

  const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
  let fullText = '';
  
  console.log(`Extracting raw semantic text logically from ${pdf.numPages} absolute pages...`);
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
  }
  
  return fullText;
}

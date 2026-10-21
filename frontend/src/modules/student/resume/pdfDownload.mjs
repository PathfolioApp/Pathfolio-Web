// Never save an HTML preview or JSON error under a .pdf filename.
export async function readPdfResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Unable to download the PDF. Please try again.');
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/pdf')) {
    throw new Error('The server did not return a PDF. Please try again.');
  }
  const blob = await response.blob();
  if (await blob.slice(0, 5).text() !== '%PDF-') {
    throw new Error('The downloaded document is not a valid PDF. Please try again.');
  }
  return blob;
}

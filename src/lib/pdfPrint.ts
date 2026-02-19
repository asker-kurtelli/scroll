export async function printHtmlAsPdf(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
      document.body.removeChild(iframe);
      reject(new Error('Could not create print frame'));
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = () => {
      try { document.body.removeChild(iframe); } catch { /* already removed */ }
    };

    iframe.onload = () => {
      try {
        iframe.contentWindow!.focus();
        iframe.contentWindow!.print();
      } catch (err) {
        cleanup();
        reject(err);
        return;
      }

      // Clean up after print dialog closes
      iframe.contentWindow!.addEventListener('afterprint', () => {
        cleanup();
        resolve();
      });

      // Fallback timeout in case afterprint doesn't fire
      setTimeout(() => {
        cleanup();
        resolve();
      }, 60000);
    };
  });
}

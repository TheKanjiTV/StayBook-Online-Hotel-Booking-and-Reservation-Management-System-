document.getElementById('printReceipt').addEventListener('click', async event => {
  const button = event.target; button.disabled = true;
  try { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); window.print(); }
  finally { button.disabled = false; }
});

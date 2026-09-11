/* eslint-disable @typescript-eslint/no-require-imports */
const XLSX = require('@e965/xlsx');
const { PDFParse } = require('pdf-parse');
// This file is launched with child_process.fork; IPC is intentionally the only input/output.
process.on('message', async ({ extension, data }) => {
  try {
    const bytes = Buffer.from(data, 'base64');
    if (extension === 'pdf') {
      const parser = new PDFParse({ data: bytes });
      const result = await parser.getText();
      await parser.destroy();
      if (result.pages.length > 100) throw new Error('pages');
      process.send({ text: result.text, cells: [] });
    } else {
      const book = XLSX.read(bytes, { type: 'buffer', cellText: true, cellDates: false });
      if (book.SheetNames.length > 20) throw new Error('sheets');
      const cells = [];
      for (const name of book.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, raw: false });
        for (const row of rows) {
          if (cells.length >= 5000) break;
          cells.push((Array.isArray(row) ? row : []).slice(0, 100).map(value => String(value ?? '').slice(0, 500)));
        }
      }
      process.send({ text: cells.map(row => row.join(' | ')).join('\n'), cells });
    }
  } catch {
    process.send({ error: true });
  }
});
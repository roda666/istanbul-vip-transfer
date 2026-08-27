import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const TARGETS = [
  'lib/chatbot-ai.ts',
  'app/data/submit-request/route.ts',
  'app/data/contact/route.ts',
  'lib/newsletter.ts',
  'app/admin/api/auth/reset-password/route.ts',
];
const ALLOWED_INTERNAL_LOG_LABELS = new Set(['[contact]']);

const FORBIDDEN = [
  {
    name: 'köşeli parantezli yer tutucu',
    pattern: /\[\s*[^\]\n]*(?:buraya|bağlantı|link|adres|url|reservation|booking|contact|whatsapp|form)[^\]\n]*\s*\]/giu,
  },
  {
    name: 'büyük harfli yer tutucu',
    pattern: /\[\s*(?:[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9_ -]{1,}|\.{2,})\s*\]/gu,
  },
  { name: 'mustache yer tutucusu', pattern: /\{\{\s*[^{}]*\s*\}\}/g },
  { name: 'boş JavaScript değişkeni', pattern: /\$\{\s*\}/g },
  { name: 'template yer tutucusu', pattern: /<%\s*[^%]*\s*%>/g },
  { name: 'örnek alan adı', pattern: /\b(?:example\.(?:com|org|net)|your-domain\.[a-z]{2,})\b/giu },
  { name: 'boş bağlantı', pattern: /href\s*=\s*["'](?:#|javascript:void\(0\))["']/giu },
];

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function staticMessageChunks(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const chunks = [];
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      chunks.push({ text: node.text, index: node.getStart(sourceFile) });
    } else if (ts.isTemplateExpression(node)) {
      chunks.push({ text: node.head.text, index: node.head.getStart(sourceFile) });
      for (const span of node.templateSpans) {
        chunks.push({ text: span.literal.text, index: span.literal.getStart(sourceFile) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return chunks;
}

const findings = [];
for (const relativePath of TARGETS) {
  const absolutePath = path.join(ROOT, relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const chunks = staticMessageChunks(source, relativePath);
  for (const chunk of chunks) {
    if (ALLOWED_INTERNAL_LOG_LABELS.has(chunk.text)) continue;
    for (const { name, pattern } of FORBIDDEN) {
      pattern.lastIndex = 0;
      for (const match of chunk.text.matchAll(pattern)) {
        if (ALLOWED_INTERNAL_LOG_LABELS.has(match[0])) continue;
        findings.push({
          file: relativePath,
          line: lineNumber(source, chunk.index),
          name,
          value: match[0].replace(/\s+/g, ' ').slice(0, 100),
        });
      }
    }
  }
  const emptyInterpolation = /\$\{\s*\}/g;
  for (const match of source.matchAll(emptyInterpolation)) {
    findings.push({
      file: relativePath,
      line: lineNumber(source, match.index ?? 0),
      name: 'boş JavaScript değişkeni',
      value: match[0],
    });
  }
}

if (findings.length > 0) {
  console.error('✗ Müşteriye giden mesaj şablonlarında doldurulmamış alan bulundu:');
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line} — ${finding.name}: ${finding.value}`);
  }
  process.exit(1);
}

console.log(`✓ ${TARGETS.length} chatbot/rezervasyon/iletişim e-posta şablonu yer tutucu içermiyor.`);
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const vehiclesPath = resolve(root, 'app/admin/(protected)/araclar/_AraclarList.tsx');
const categoriesPath = resolve(root, 'app/admin/(protected)/kategoriler/page.tsx');
const servicesPath = resolve(root, 'app/admin/(protected)/hizmetler/_HizmetlerList.tsx');
const expected = ['up', 'down', 'edit', 'activation', 'delete'];

function actionProps(path) {
  const source = readFileSync(path, 'utf8');
  const match = source.match(/<AdminRecordActions\b([\s\S]*?)\/>/);
  if (!match) throw new Error(`AdminRecordActions bulunamadı: ${path}`);
  return [...match[1].matchAll(/^\s+(up|down|edit|activation|archive|delete)\s*=\s*\{/gm)]
    .map((item) => item[1]);
}

function assertCardContract(path, label) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes('AdminCmsRecordCard')) {
    throw new Error(`${label} AdminCmsRecordCard standardını kullanmıyor.`);
  }
  if (!source.includes('data-admin-record-actions-row')) {
    throw new Error(`${label} data-admin-record-actions-row marker'ı eksik.`);
  }
  return source;
}

const vehicleSource = assertCardContract(vehiclesPath, 'Araçlar');
assertCardContract(categoriesPath, 'Kategoriler');
if (/<table\b|vehicle-list-table/.test(vehicleSource)) {
  throw new Error('Araçlar ekranı tablo DOM/layout standardına geri dönmüş; AdminCmsRecordCard kullanılmalı.');
}

const vehicles = actionProps(vehiclesPath);
const categories = actionProps(categoriesPath);
if (JSON.stringify(vehicles) !== JSON.stringify(expected)) {
  throw new Error(`Araçlar aksiyon sözleşmesi bozuldu. Beklenen ${expected.join(',')}, bulunan ${vehicles.join(',')}.`);
}
if (JSON.stringify(categories) !== JSON.stringify(expected)) {
  throw new Error(`Kategoriler referans aksiyon sözleşmesi bozuldu. Beklenen ${expected.join(',')}, bulunan ${categories.join(',')}.`);
}

const serviceSource = readFileSync(servicesPath, 'utf8');
if (!serviceSource.includes('AdminCmsRecordCard')) {
  throw new Error('Hizmetler AdminCmsRecordCard standardını kullanmıyor.');
}
if (/hl-table-wrap|hl-table-row|onDuplicate|handleDuplicate|Kopyala/.test(serviceSource)) {
  throw new Error('Hizmetler eski tablo/kopyalama sözleşmesine geri dönmüş.');
}
if (!/\.hl-cards\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;\s*gap:\s*8px;/.test(serviceSource)) {
  throw new Error('Hizmet kartları 8px aralık sözleşmesini kullanmıyor.');
}
if (!/delete=\{\{[\s\S]*?onClick:\s*\(\)\s*=>\s*onDelete\(item\)/.test(serviceSource)
    || !serviceSource.includes('Bu satırın veritabanında silinebilecek bir hizmet kaydı yok.')) {
  throw new Error('Hizmetler listesindeki her satır için güvenli Sil sözleşmesi eksik.');
}

console.log(`Admin action contract OK: ${expected.join(' → ')}`);
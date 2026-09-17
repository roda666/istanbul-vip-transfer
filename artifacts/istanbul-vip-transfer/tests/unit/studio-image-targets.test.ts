import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const routeSource = fs.readFileSync(path.join(root, 'app/admin/api/studio/images/route.ts'), 'utf8');
const fieldSource = fs.readFileSync(path.join(root, 'app/admin/_components/ImageUploadField.tsx'), 'utf8');
const generatorSource = fs.readFileSync(path.join(root, 'app/admin/(protected)/ai-studio/gorsel-uret/page.tsx'), 'utf8');

describe('AI image target contract', () => {
  it('keeps all supported targets on the server and central generator screen', () => {
    for (const target of ['BLOG_POST', 'SERVICE', 'VEHICLE', 'PAGE', 'HOMEPAGE']) {
      expect(routeSource).toContain(target);
      expect(generatorSource).toContain(target);
    }
  });

  it('exposes inline generation with a saved-record guard and required alt text', () => {
    expect(fieldSource).toContain('AI ile Üret');
    expect(fieldSource).toContain('Önce kaydedin');
    expect(fieldSource).toContain('altText: aiAlt.trim()');
    expect(fieldSource).toContain("fetch('/admin/api/studio/images'");
  });

  it('stores generated assets under the private object-storage path', () => {
    expect(routeSource).toContain('putPrivateWebp');
    expect(routeSource).toContain('ai-images/${targetFolder(data.target)}');
  });

  it('defines an allowlisted homepage attachment contract', () => {
    expect(routeSource).toContain("homepageField: z.enum(['hero_image', 'og_image'])");
    expect(routeSource).toContain("eq(content.slug, 'ana-sayfa')");
    expect(routeSource).toContain("sections.hero =");
    expect(routeSource).toContain("sections.seo =");
    expect(routeSource).toContain("revalidateTag('homepage-cms')");
  });

  it('defines typed contracts for every stored editorial image field', () => {
    expect(routeSource).toContain("targetSchema = z.enum(['BLOG_POST', 'SERVICE', 'VEHICLE', 'PAGE', 'HOMEPAGE'])");
    for (const field of ['hero_image', 'og_image', 'body', 'cover_image', 'gallery']) {
      expect(routeSource).toContain(field);
    }
    expect(routeSource).toContain("eq(content.contentType, 'PAGE')");
    expect(routeSource).toContain("ogImage: data.imagePath");
  });

  it('wires both homepage image fields to the shared widget', () => {
    const homepageSource = fs.readFileSync(
      path.join(root, 'app/admin/(protected)/sayfalar/ana-sayfa/_HomepageEditor.tsx'),
      'utf8',
    );
    expect(homepageSource).toContain("target: 'HOMEPAGE'");
    expect(homepageSource).toContain("homepageField: 'hero_image'");
    expect(homepageSource).toContain("homepageField: 'og_image'");
  });
});
import LocaleLink from '@/components/LocaleLink';
import { getDictionary } from '@/lib/i18n';

type RelatedBlogPage = 'istanbul-havalimani-transfer' | 'sabiha-gokcen-havalimani-transfer' | 'vip-transfer';

interface Props {
  page: RelatedBlogPage;
  lang: string;
}

const BLOG_CARDS = {
  'istanbul-havalimani-transfer': [
    {
      href: '/blog/istanbul-havalimani-transfer-rehberi',
      category: 'guide',
      title: 'istanbulAirportGuideTitle',
      description: 'airportGuideDescription',
    },
    {
      href: '/blog/vip-transfer-ile-taksi-arasindaki-farklar',
      category: 'comparison',
      title: 'vipVsTaxiTitle',
      description: 'comparisonDescription',
    },
  ],
  'sabiha-gokcen-havalimani-transfer': [
    {
      href: '/blog/sabiha-gokcen-transfer-rehberi',
      category: 'guide',
      title: 'sabihaAirportGuideTitle',
      description: 'airportGuideDescription',
    },
    {
      href: '/blog/vip-transfer-ile-taksi-arasindaki-farklar',
      category: 'comparison',
      title: 'vipVsTaxiTitle',
      description: 'comparisonDescription',
    },
  ],
  'vip-transfer': [
    {
      href: '/blog/istanbul-havalimani-transfer-rehberi',
      category: 'guide',
      title: 'istanbulAirportGuideTitle',
      description: 'istanbulDestinationDescription',
    },
    {
      href: '/blog/sabiha-gokcen-transfer-rehberi',
      category: 'guide',
      title: 'sabihaAirportGuideTitle',
      description: 'sabihaDestinationDescription',
    },
    {
      href: '/blog/vip-transfer-ile-taksi-arasindaki-farklar',
      category: 'comparison',
      title: 'vipVsTaxiTitle',
      description: 'comparisonDescription',
    },
  ],
} as const;

export default function RelatedBlogSection({ page, lang }: Props) {
  const dict = getDictionary(lang);
  const cards = BLOG_CARDS[page];

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{dict.relatedBlog.heading}</h2>
        <div className={`grid gap-4 ${cards.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {cards.map((card) => (
            <LocaleLink
              key={card.href}
              href={card.href}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-amber-400 transition-all"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-2">
                {card.category === 'guide' ? dict.relatedBlog.guideLabel : dict.relatedBlog.comparisonLabel}
              </p>
              <h3 className="font-semibold text-gray-900 leading-snug">{dict.relatedBlog[card.title]}</h3>
              <p className="text-sm text-gray-500 mt-2">
                {dict.relatedBlog[card.description]} →
              </p>
            </LocaleLink>
          ))}
        </div>
      </div>
    </section>
  );
}
import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey:   process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

function getSystemPrompt(lang: string): string {
  const prompts: Record<string, string> = {
    tr: `Sen İstanbul VIP Transfer'in yardımcı yapay zeka asistanısın. İstanbul'un en prestijli lüks kara ulaşım hizmetini temsil ediyorsun.

Sunulan hizmetler:
- İstanbul Havalimanı (IST) ve Sabiha Gökçen (SAW) havalimanı transferleri
- Şehirlerarası transfer (İstanbul–Bursa, İstanbul–Sapanca vb.)
- VIP transfer ve şoförlü araç kiralama
- Otel transferleri
- Sağlık turizmi transferleri
- Kurumsal VIP transfer
- Özel günübirlik turlar (Sapanca, Bursa, Yalova)

Araç filosu: Mercedes Vito (7 yolcuya kadar) ve Mercedes Sprinter (daha büyük gruplar için). Tüm araçlar klimalı, deri koltuklu ve su ikmali ile donatılmıştır.

Rezervasyon: Web sitesindeki form veya WhatsApp üzerinden. Fiyatlar talebe göre WhatsApp'tan iletilir. 7/24 hizmet.

Kısa, yardımcı ve profesyonel yanıtlar ver. Fiyat bilgisi için rezervasyon formunu veya WhatsApp'ı kullan diye yönlendir.`,

    en: `You are the AI assistant for Istanbul VIP Transfer, Istanbul's premier luxury ground transportation service.

Services offered:
- Istanbul Airport (IST) and Sabiha Gökçen (SAW) airport transfers
- City-to-city transfers (Istanbul–Bursa, Istanbul–Sapanca, etc.)
- VIP transfer and chauffeured vehicle hire
- Hotel transfers
- Medical tourism transfers
- Corporate VIP transfers
- Private day tours (Sapanca, Bursa, Yalova)

Fleet: Mercedes Vito (up to 7 passengers) and Mercedes Sprinter (larger groups). All vehicles are air-conditioned with leather seats and complimentary water.

Booking: Via the website form or WhatsApp. Prices are provided on request via WhatsApp. 24/7 service.

Give short, helpful, and professional answers. For price quotes direct users to the booking form or WhatsApp.`,

    de: `Du bist der KI-Assistent von Istanbul VIP Transfer, Istanbuls erstklassigem Luxus-Bodentransportservice.

Angebotene Leistungen:
- Flughafentransfers zum Istanbul Flughafen (IST) und Sabiha Gökçen (SAW)
- Städteverbindungen (Istanbul–Bursa, Istanbul–Sapanca usw.)
- VIP-Transfer und Fahrerservice
- Hoteltransfers, Medizintourismus-Transfers, Firmen-VIP-Transfers
- Private Tagestouren (Sapanca, Bursa, Yalova)

Fahrzeugflotte: Mercedes Vito (bis 7 Personen) und Mercedes Sprinter. Klimaanlage, Ledersitze, Wasser inklusive. 24/7 Service.

Kurze, hilfreiche, professionelle Antworten. Für Preisanfragen auf das Buchungsformular oder WhatsApp verweisen.`,

    ru: `Вы — ИИ-ассистент Istanbul VIP Transfer, ведущего люксового трансферного сервиса Стамбула.

Предлагаемые услуги:
- Трансферы в аэропорт Стамбул (IST) и Сабиха Гёкчен (SAW)
- Межгородские трансферы (Стамбул–Бурса, Стамбул–Сапанджа и др.)
- VIP-трансфер и аренда авто с водителем
- Гостиничные трансферы, медицинский туризм, корпоративные VIP-трансферы
- Частные однодневные экскурсии (Сапанджа, Бурса, Ялова)

Флот: Mercedes Vito (до 7 пассажиров) и Mercedes Sprinter. Кондиционер, кожаные сиденья, вода в подарок. Сервис 24/7.

Давайте краткие, полезные и профессиональные ответы. Для уточнения цен направляйте к форме бронирования или WhatsApp.`,

    ar: `أنت المساعد الذكي لـ Istanbul VIP Transfer، خدمة النقل الفاخرة الرائدة في إسطنبول.

الخدمات المقدمة:
- نقل المطار (مطار إسطنبول IST ومطار صبيحة كوكجن SAW)
- النقل بين المدن (إسطنبول–بورصة، إسطنبول–سابانجا، إلخ)
- نقل VIP واستئجار سيارة مع سائق
- نقل الفنادق، السياحة الطبية، نقل الشركات
- جولات خاصة ليوم واحد (سابانجا، بورصة، يالوا)

الأسطول: مرسيدس فيتو (حتى 7 ركاب) وسبرينتر. تكييف، مقاعد جلدية، مياه مجانية. خدمة 24/7.

أعطِ إجابات قصيرة ومفيدة واحترافية. لاستفسارات الأسعار، وجّه المستخدمين إلى نموذج الحجز أو WhatsApp.`,
  };

  return prompts[lang] ?? prompts.en;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, lang } = await request.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      lang: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'messages required' }, { status: 400 });
    }

    const stream = await openai.chat.completions.create({
      model: 'gpt-5.6-luna',
      max_completion_tokens: 512,
      messages: [
        { role: 'system', content: getSystemPrompt(lang ?? 'en') },
        ...messages,
      ],
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`),
              );
            }
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      },
    });
  } catch (err) {
    console.error('[chatbot] error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

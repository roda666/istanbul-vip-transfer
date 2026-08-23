/**
 * Explicit, reviewable image briefs for the service-image batch job.
 * There is deliberately no fallback: adding a service requires adding both a
 * prompt and useful alternative text here before it can be generated.
 */
export const SERVICE_IMAGE_PROMPT_SUFFIX = 'No text, logo, brand emblem, readable sign, or visible license plate. If a person appears, show only a back, profile, or distant view with no face focus.';

type ServiceImageBrief = {
  prompt: string;
  altText: string;
};

function brief(prompt: string, altText: string): ServiceImageBrief {
  return { prompt: `${prompt} ${SERVICE_IMAGE_PROMPT_SUFFIX}`, altText };
}

export const SERVICE_HERO_IMAGE_CONFIG: Record<string, ServiceImageBrief> = {
  'istanbul-havalimani-transfer': brief('Cinematic exterior of a dark luxury passenger minivan waiting at a contemporary airport terminal entrance in warm evening light, with a suited chauffeur beside the open door. Ultra-realistic premium travel photography, wide landscape composition.', 'Modern airport terminal girişinde şoförlü koyu renkli lüks transfer aracı'),
  'sabiha-gokcen-havalimani-transfer': brief('An elegant dark luxury passenger van at a modern airport curb beneath a clear sky, ready for arriving guests, with softly blurred hills in the distance. Ultra-realistic premium travel photography, wide landscape composition.', 'Modern havalimanı önünde yolcularını bekleyen lüks transfer aracı'),
  'kurumsal-vip-transfer': brief('A dark executive passenger vehicle outside a contemporary glass business building at dusk, with a chauffeur preparing the rear door; city lights are softly out of focus. Ultra-realistic premium business travel photography, wide landscape composition.', 'Modern iş merkezinin önünde şoförlü kurumsal transfer aracı'),
  'vip-transfer': brief('Cinematic elevated view of a dark luxury passenger vehicle travelling along a broad waterside urban route at sunset, with warm city lights reflected on the water. Ultra-realistic premium travel photography, wide landscape composition.', 'Gün batımında sahil yolu boyunca ilerleyen lüks VIP transfer aracı'),
  'sehir-ici-transfer': brief('A refined dark passenger vehicle on a clean historic urban street in warm evening light, surrounded by distinctive but unnamed heritage architecture. Ultra-realistic premium city transfer photography, wide landscape composition.', 'Tarihi şehir sokağında ilerleyen şoförlü lüks transfer aracı'),
  'sehirler-arasi-transfer': brief('A dark luxury passenger van on a scenic intercity highway through rolling green hills at sunrise, with a distant coastal horizon. Ultra-realistic premium road travel photography, wide landscape composition.', 'Gün doğumunda şehirler arası yolda ilerleyen lüks transfer aracı'),
  'otel-transfer': brief('A dark luxury passenger vehicle at the softly lit entrance of an upscale waterfront hotel at blue hour, with discreet luggage assistance. Ultra-realistic premium hospitality travel photography, wide landscape composition.', 'Lüks otel girişinde konuklarını karşılayan şoförlü transfer aracı'),
  'soforlu-arac-kiralama': brief('A polished dark chauffeured passenger vehicle in a spacious modern transport terminal, with a professionally dressed driver waiting beside it. Ultra-realistic premium travel photography, wide landscape composition.', 'Modern terminalde bekleyen şoförlü lüks araç'),
  'saglik-turizmi-transfer': brief('A calm dark luxury passenger vehicle outside a contemporary healthcare building, with a chauffeur offering discreet assistance to a distant guest. Ultra-realistic reassuring travel photography, wide landscape composition.', 'Modern sağlık merkezi önünde yardım için bekleyen transfer aracı'),
  'istanbul-gunubirlik-turlar': brief('A luxury passenger van parked near a sunlit historic city viewpoint, with visitors seen only from behind admiring the layered old-city skyline. Ultra-realistic premium day-trip photography, wide landscape composition.', 'Tarihi şehir manzarası yakınında bekleyen günlük tur transfer aracı'),
  'istanbul-bursa-transfer': brief('A dark luxury passenger vehicle on a coastal route with calm water and distant snow-dusted mountains under clear morning light. Ultra-realistic premium intercity travel photography, wide landscape composition.', 'Kıyı yolu ve uzak dağlar eşliğinde ilerleyen lüks transfer aracı'),
  'istanbul-sapanca-transfer': brief('An elegant dark passenger vehicle arriving beside a tranquil lakeshore lined with lush trees and misty hills. Ultra-realistic premium nature escape photography, wide landscape composition.', 'Göl kıyısında yeşil doğa manzarasına ulaşan lüks transfer aracı'),
  'sapanca-masukiye-turu': brief('A dark luxury passenger vehicle at a quiet forest retreat with a small cascade and natural wooden surroundings. Ultra-realistic premium nature tour photography, wide landscape composition.', 'Orman içindeki dinlenme alanında bekleyen günlük tur transfer aracı'),
  'bursa-gunubirlik-tur': brief('A luxury passenger van at a peaceful old-city viewpoint with ornate but unnamed historic architecture and a mountain backdrop in golden afternoon light. Ultra-realistic premium day-tour photography, wide landscape composition.', 'Tarihi şehir ve dağ manzarası yakınında bekleyen günlük tur aracı'),
  'yalova-gunubirlik-tur': brief('A dark luxury passenger vehicle near a quiet ferry dock overlooking open water in soft morning light. Ultra-realistic premium day-trip photography, wide landscape composition.', 'Sabah ışığında feribot iskelesi yakınında bekleyen lüks transfer aracı'),
  'ucus-karsilama-meet-greet': brief('A welcoming airport arrivals scene with a discreetly dressed host beside a dark luxury passenger vehicle, shown from behind near a bright modern terminal. Ultra-realistic premium meet-and-greet photography, wide landscape composition.', 'Havalimanı geliş terminalinde konuk karşılamaya hazır transfer aracı ve görevli'),
  'ankara-vip-transfer': brief('A dark luxury passenger vehicle on a broad, orderly boulevard near contemporary civic-style buildings at sunset. Ultra-realistic premium city transfer photography, wide landscape composition.', 'Geniş şehir bulvarında ilerleyen Ankara VIP transfer aracı'),
  'antalya-vip-transfer': brief('An elegant dark luxury passenger vehicle on a palm-lined coastal boulevard with bright Mediterranean light and a distant sea view. Ultra-realistic premium travel photography, wide landscape composition.', 'Palmiye sıralı sahil yolunda ilerleyen Antalya VIP transfer aracı'),
  'izmir-vip-transfer': brief('A refined dark passenger vehicle travelling beside a sunlit waterfront promenade with a gentle bay in the background. Ultra-realistic premium city transfer photography, wide landscape composition.', 'Körfez manzaralı sahil yolunda ilerleyen İzmir VIP transfer aracı'),
  'gelin-arabasi-kiralama': brief('An elegant decorated dark wedding passenger vehicle waiting outside a tasteful garden venue at golden hour, with a couple visible only from behind at a distance. Ultra-realistic premium wedding photography, wide landscape composition.', 'Bahçe düğün mekânı önünde bekleyen zarif süslenmiş gelin arabası'),
  'vip-protokol-secim-araci': brief('A discreet dark executive passenger vehicle arriving at a formal contemporary event entrance, with a distant suited attendant opening a door. Ultra-realistic premium protocol transport photography, wide landscape composition.', 'Resmî etkinlik girişinde bekleyen şoförlü protokol aracı'),
  'gunluk-villa-kiralama': brief('A dark luxury passenger vehicle arriving at a serene private holiday home surrounded by trees, with a poolside terrace visible in the distance. Ultra-realistic premium holiday travel photography, wide landscape composition.', 'Ağaçlarla çevrili tatil evi önüne gelen lüks transfer aracı'),
};

export function getServiceHeroImageConfig(slug: string): ServiceImageBrief | null {
  const config = SERVICE_HERO_IMAGE_CONFIG[slug];
  if (!config || !config.prompt.trim() || !config.altText.trim()) return null;
  return config;
}
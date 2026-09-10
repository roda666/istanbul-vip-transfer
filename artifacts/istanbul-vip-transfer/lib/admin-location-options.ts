export const ISTANBUL_DISTRICTS = [
  'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler',
  'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü',
  'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt',
  'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane',
  'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer',
  'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla',
  'Ümraniye', 'Üsküdar', 'Zeytinburnu',
] as const;

export type ManagedLocationOption = {
  id: string;
  name: string;
  city: string;
  district: string | null;
  type: 'AIRPORT' | 'DISTRICT' | 'REGION' | 'HOTEL_ZONE' | 'CUSTOM' | 'PROVINCE';
  displayOrder: number;
};

export function groupManagedLocationOptions<T extends ManagedLocationOption>(locations: T[]) {
  const collator = new Intl.Collator('tr-TR', { sensitivity: 'base' });
  const byName = (a: T, b: T) => collator.compare(a.name, b.name);
  const airportOrder = (a: T, b: T) => a.displayOrder - b.displayOrder || byName(a, b);
  return [
    {
      label: 'İstanbul Havalimanları',
      items: locations.filter(item => item.type === 'AIRPORT' && item.city === 'İstanbul').sort(airportOrder),
    },
    {
      label: 'İstanbul İlçeleri',
      items: locations.filter(item => item.type === 'DISTRICT' && item.city === 'İstanbul').sort(byName),
    },
    {
      label: 'Diğer İller',
      items: locations.filter(item => item.type === 'PROVINCE' && item.city !== 'İstanbul').sort(byName),
    },
    {
      label: 'Diğer Lokasyonlar',
      items: locations.filter(item =>
        !(item.type === 'AIRPORT' && item.city === 'İstanbul')
        && !(item.type === 'DISTRICT' && item.city === 'İstanbul')
        && !(item.type === 'PROVINCE' && item.city !== 'İstanbul'),
      ).sort(byName),
    },
  ].filter(group => group.items.length > 0);
}
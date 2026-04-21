export interface SocialLinks {
  website?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
  spotify?: string;
}

export type StationCategory = 'commercial' | 'religious' | 'state';

export interface Station {
  id: string;
  name: string;
  frequency: string;
  streamUrl: string;
  logoUrl: string;
  social: SocialLinks;
  instagramHandle?: string;
  instagramFollowers?: number;
  category: StationCategory;
  pracaId?: string;
}

// DB row shape from the stations table
export interface DbStation {
  id: string;
  name: string;
  frequency: string;
  stream_url: string;
  logo_url: string;
  category: string;
  display_order: number;
  active: boolean;
  praca_id: string;
}

/** Convert DB row to app Station */
export function dbToStation(row: DbStation): Station {
  return {
    id: row.id,
    name: row.name,
    frequency: row.frequency,
    streamUrl: row.stream_url,
    logoUrl: row.logo_url,
    category: (row.category as StationCategory) || 'commercial',
    pracaId: row.praca_id,
    social: {},
  };
}

// Hardcoded fallback — used only if DB fetch fails
export const fallbackStations: Station[] = [
  {
    id: "98fm", name: "98 FM NATAL", frequency: "98,9 MHz",
    streamUrl: "http://cast42.sitehosting.com.br:8010",
    logoUrl: "https://98fmnatal.com.br/site-core/views/18359912b2/inc/site/assets/images/new-logo2.png",
    category: 'commercial', social: {},
    pracaId: 'a0000000-0000-0000-0000-000000000001',
  },
  {
    id: "97fm", name: "97 FM NATAL", frequency: "97,9 MHz",
    streamUrl: "https://azevedo.jmvstream.com/stream",
    logoUrl: "https://97fmnatal.com.br/images/logo.png",
    category: 'commercial', social: {},
    pracaId: 'a0000000-0000-0000-0000-000000000001',
  },
];

export function getDefaultVisibleStations(stationList: Station[]): string[] {
  return stationList.filter(s => s.category === 'commercial').map(s => s.id);
}

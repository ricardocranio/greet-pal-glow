export interface SocialLinks {
  website?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
  spotify?: string;
}

export interface Station {
  id: string;
  name: string;
  frequency: string;
  streamUrl: string;
  logoUrl: string;
  social: SocialLinks;
  instagramHandle?: string;
  instagramFollowers?: number;
}

export const stations: Station[] = [
  {
    id: "98fm",
    name: "98 FM NATAL",
    frequency: "98,9 MHz",
    streamUrl: "https://cast42.sitehosting.com.br:8010",
    logoUrl: "https://98fmnatal.com.br/site-core/views/18359912b2/inc/site/assets/images/new-logo2.png",
    instagramHandle: "@98fmnatal",
    instagramFollowers: 312000,
    social: {
      website: "https://98fmnatal.com.br",
      instagram: "https://www.instagram.com/98fmnatal",
      facebook: "https://www.facebook.com/98fmnatal",
      youtube: "https://www.youtube.com/@98fmnatal",
    },
  },
  {
    id: "97fm",
    name: "97 FM NATAL",
    frequency: "97,9 MHz",
    streamUrl: "https://azevedo.jmvstream.com/",
    logoUrl: "https://97fmnatal.com.br/images/logo.png",
    instagramHandle: "@97fmnatal",
    instagramFollowers: 185000,
    social: {
      website: "https://97fmnatal.com.br",
      instagram: "https://www.instagram.com/97fmnatal",
    },
  },
  {
    id: "96fm",
    name: "96 FM NATAL",
    frequency: "96,7 MHz",
    streamUrl: "http://centova10.ciclanohost.com.br:6258",
    logoUrl: "https://96fm.com.br/build/assets/logo-fba33526.png",
    instagramHandle: "@96fmnatal",
    instagramFollowers: 245000,
    social: {
      website: "https://www.96fm.com.br",
      instagram: "https://www.instagram.com/96fmnatal",
      facebook: "https://pt-br.facebook.com/Natal96fm",
      twitter: "https://twitter.com/96fmnatal",
      youtube: "https://www.youtube.com/channel/UCPvUFqjcgSQ_CIiZn_DqQMQ",
    },
  },
  {
    id: "95fm",
    name: "95 FM NATAL",
    frequency: "95,9 MHz",
    streamUrl: "https://radio.saopaulo01.com.br:10841",
    logoUrl: "https://www.95maisfm.com.br/wp-content/uploads/2020/06/logo-1.png",
    instagramHandle: "@95maisfm",
    instagramFollowers: 42000,
    social: {
      website: "https://www.95maisfm.com.br",
      instagram: "https://www.instagram.com/95maisfm",
      facebook: "https://www.facebook.com/95maisfm",
    },
  },
  {
    id: "91fm",
    name: "RURAL DE NATAL FM",
    frequency: "91,9 MHz",
    streamUrl: "https://live9.livemus.com.br:27802",
    logoUrl: "https://static.wixstatic.com/media/a8ed9c_7c3021d0f64f46d3a50f3f7f4bc8835d~mv2.png",
    instagramHandle: "@ruraldenatalfm",
    instagramFollowers: 28000,
    social: {
      website: "https://www.ruraldenatalfm.com.br",
      instagram: "https://www.instagram.com/ruraldenatalfm",
      facebook: "https://www.facebook.com/ruraldenatalfm",
      youtube: "https://www.youtube.com/@ruraldenatalfm",
      linkedin: "https://www.linkedin.com/company/ruraldenatalfm",
      twitter: "https://twitter.com/ruraldenatalfm",
      spotify: "https://open.spotify.com/show/ruraldenatalfm",
    },
  },
  {
    id: "clubefm",
    name: "CLUBE FM NATAL",
    frequency: "106,3 MHz",
    streamUrl: "https://radios.braviahost.com.br:2020/stream/clubfmnatal",
    logoUrl: "https://painel.clube.fm/wp-content/uploads/2025/02/Logo-Clube-106-3.png",
    instagramHandle: "@clubenatal",
    instagramFollowers: 15000,
    social: {
      website: "https://clube.fm/natal",
      instagram: "https://www.instagram.com/clubenatal",
    },
  },
  {
    id: "mundialfm",
    name: "MUNDIAL FM NATAL",
    frequency: "91,1 MHz",
    streamUrl: "https://stm4.srvstm.com:7252",
    logoUrl: "/logos/mundial-fm.jpeg",
    instagramHandle: "@radiomundialnatal",
    instagramFollowers: 8500,
    social: {
      website: "https://www.radiomundialfm.com.br",
      instagram: "https://www.instagram.com/radiomundialnatal",
    },
  },
  {
    id: "jpnatal",
    name: "JP FM NATAL",
    frequency: "99,5 MHz",
    streamUrl: "https://pannatal.jmvstream.com/index.html?sid=1",
    logoUrl: "https://jpimg.com.br/uploads/2025/04/900x900_natal-500x500.png",
    instagramHandle: "@jovempannatal",
    instagramFollowers: 52000,
    social: {
      website: "https://jovempan.com.br/afiliada/natal-fm",
      instagram: "https://www.instagram.com/jovempannatal",
      facebook: "https://www.facebook.com/jpfmnatal",
      twitter: "https://twitter.com/jpfmnatal",
      youtube: "https://www.youtube.com/@jpfmnatal",
    },
  },
  {
    id: "jpnews",
    name: "JP NEWS NATAL",
    frequency: "93,5 MHz",
    streamUrl: "https://s02.maxcast.com.br:8082/",
    logoUrl: "https://jpimg.com.br/uploads/2024/02/avatar-news-natal-rgb-500x500.png",
    instagramHandle: "@jovempannewsnatal",
    instagramFollowers: 35000,
    social: {
      website: "https://jovempan.com.br",
      instagram: "https://www.instagram.com/jovempannewsnatal",
      facebook: "https://www.facebook.com/jpnewsnatal",
    },
  },
  {
    id: "104fm",
    name: "104 FM NATAL",
    frequency: "104,7 MHz",
    streamUrl: "https://radios.braviahost.com.br:8000/",
    logoUrl: "https://104fmprazeremouvir.com.br/assets/img/logo/logo-white.png",
    instagramHandle: "@siga104fm",
    instagramFollowers: 18000,
    social: {
      website: "https://104fmprazeremouvir.com.br",
      instagram: "https://www.instagram.com/siga104fm",
      facebook: "https://www.facebook.com/104fmnatal",
    },
  },
];

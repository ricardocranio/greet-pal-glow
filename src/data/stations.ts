export interface Station {
  id: string;
  name: string;
  frequency: string;
  streamUrl: string;
}

export const stations: Station[] = [
  { id: "98fm", name: "98 FM NATAL", frequency: "98,9 MHz", streamUrl: "http://cast42.sitehosting.com.br:8010" },
  { id: "97fm", name: "97 FM NATAL", frequency: "97,9 MHz", streamUrl: "https://azevedo.jmvstream.com/" },
  { id: "96fm", name: "96 FM NATAL", frequency: "96,7 MHz", streamUrl: "http://centova10.ciclanohost.com.br:6258" },
  { id: "95fm", name: "95 FM NATAL", frequency: "95,9 MHz", streamUrl: "https://radio.saopaulo01.com.br:10841" },
  { id: "91fm", name: "91 FM NATAL", frequency: "91,9 MHz", streamUrl: "https://live9.livemus.com.br:27802" },
  { id: "clubefm", name: "CLUBE FM NATAL", frequency: "106,3 MHz", streamUrl: "http://radios.braviahost.com.br:8012" },
  { id: "mundialfm", name: "MUNDIAL FM NATAL", frequency: "91,1 MHz", streamUrl: "https://stm4.srvstm.com:7252" },
  { id: "jpnatal", name: "JP NATAL", frequency: "99,5 MHz", streamUrl: "https://pannatal.jmvstream.com/index.html?sid=1" },
  { id: "jpnews", name: "JP NEWS NATAL", frequency: "93,5 MHz", streamUrl: "https://s02.maxcast.com.br:8082/" },
  { id: "104fm", name: "104 FM NATAL", frequency: "104,7 MHz", streamUrl: "https://radios.braviahost.com.br:8000/" },
];

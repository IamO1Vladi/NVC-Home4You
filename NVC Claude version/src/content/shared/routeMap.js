// The partner page's route map: destination names per locale, and the Greek map controls.
// They lived in content/{bg,en,el}/logistics.js until the logistics page was retired into the
// delivery page (2026-10-15); the partner page still draws the map, so the lists moved here
// unchanged. bg names the destinations as en does (that is what the page always showed).

const bg = {
  sea: {
    rtm: 'Rotterdam, NL',
    ham: 'Hamburg, DE',
    ant: 'Antwerp, BE',
    pir: 'Piraeus, GR',
    vlc: 'Valencia, ES',
    cnd: 'Constanța, RO',
    var: 'Varna, BG',
    lax: 'Los Angeles, US',
    nyc: 'New York, US',
    sts: 'Santos, BR',
    cll: 'Callao, PE',
  },
  air: {
    sof: 'Sofia (SOF), BG',
    ath: 'Athens (ATH), GR',
    fra: 'Frankfurt (FRA), DE',
    cdg: 'Paris (CDG), FR',
    lhr: 'London (LHR), UK',
    jfk: 'New York (JFK), US',
    lax: 'Los Angeles (LAX), US',
    gru: 'São Paulo (GRU), BR',
  },
  rail: {
    dsg: 'Duisburg, DE',
    ham: 'Hamburg, DE',
    waw: 'Warsaw, PL',
    bud: 'Budapest, HU',
    sof: 'Sofia, BG',
  },
}

const en = {
  sea: {
    rtm: 'Rotterdam, NL',
    ham: 'Hamburg, DE',
    ant: 'Antwerp, BE',
    pir: 'Piraeus, GR',
    vlc: 'Valencia, ES',
    cnd: 'Constanța, RO',
    var: 'Varna, BG',
    lax: 'Los Angeles, US',
    nyc: 'New York, US',
    sts: 'Santos, BR',
    cll: 'Callao, PE',
  },
  air: {
    sof: 'Sofia (SOF), BG',
    ath: 'Athens (ATH), GR',
    fra: 'Frankfurt (FRA), DE',
    cdg: 'Paris (CDG), FR',
    lhr: 'London (LHR), UK',
    jfk: 'New York (JFK), US',
    lax: 'Los Angeles (LAX), US',
    gru: 'São Paulo (GRU), BR',
  },
  rail: {
    dsg: 'Duisburg, DE',
    ham: 'Hamburg, DE',
    waw: 'Warsaw, PL',
    bud: 'Budapest, HU',
    sof: 'Sofia, BG',
  },
}

const el = {
  sea: {
    rtm: 'Ρότερνταμ, Ολλανδία',
    ham: 'Αμβούργο, Γερμανία',
    ant: 'Αμβέρσα, Βέλγιο',
    pir: 'Πειραιάς, Ελλάδα',
    vlc: 'Βαλένθια, Ισπανία',
    cnd: 'Κωνστάντζα, Ρουμανία',
    var: 'Βάρνα, Βουλγαρία',
    lax: 'Λος Άντζελες, ΗΠΑ',
    nyc: 'Νέα Υόρκη, ΗΠΑ',
    sts: 'Σάντος, Βραζιλία',
    cll: 'Καγιάο, Περού',
  },
  air: {
    sof: 'Σόφια (SOF), Βουλγαρία',
    ath: 'Αθήνα (ATH), Ελλάδα',
    fra: 'Φρανκφούρτη (FRA), Γερμανία',
    cdg: 'Παρίσι (CDG), Γαλλία',
    lhr: 'Λονδίνο (LHR), Ηνωμένο Βασίλειο',
    jfk: 'Νέα Υόρκη (JFK), ΗΠΑ',
    lax: 'Λος Άντζελες (LAX), ΗΠΑ',
    gru: 'Σάο Πάολο (GRU), Βραζιλία',
  },
  rail: {
    dsg: 'Ντούισμπουργκ, Γερμανία',
    ham: 'Αμβούργο, Γερμανία',
    waw: 'Βαρσοβία, Πολωνία',
    bud: 'Βουδαπέστη, Ουγγαρία',
    sof: 'Σόφια, Βουλγαρία',
  },
}

export const routeMapDestinations = { bg, en, el }

// Leaflet's own control wording, which it writes in English. bg and en were left to Leaflet
// until 2026-10-15; now every locale names them, bg as the delivery calculator's map does.
export const routeMapControls = {
  bg: {
    zoomIn: 'Приближи',
    zoomOut: 'Отдалечи',
    attributionTitle: 'JavaScript библиотека за интерактивни карти',
    marker: 'Точка на картата',
  },
  en: {
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    attributionTitle: 'A JavaScript library for interactive maps',
    marker: 'Map pin',
  },
  el: {
    zoomIn: 'Μεγέθυνση',
    zoomOut: 'Σμίκρυνση',
    attributionTitle: 'Βιβλιοθήκη JavaScript για διαδραστικούς χάρτες',
    marker: 'Σημείο στον χάρτη',
  },
}

/*
 * Il calcolo del canone concordato secondo l'Accordo territoriale di Torino
 * del 06/12/2022 aggiornato al 15/04/2024 (in vigore dal 01/05/2024).
 * Dati in accordi/torino-2024-04-15.json. Gira nel browser e con Node.
 *
 *   CanoneTorino.calcola(accordo, scheda) -> risultato
 *
 * Come funziona l'accordo:
 * - zona dall'elenco viario (allegato 1): 1 Centro, 2 Semicentro,
 *   3 Periferia, 4 Collinare, P pregio;
 * - valori MENSILI al mq utile (allegato 2), per zona, sub-fascia e durata
 *   (3, 4, 5, 6 + 2 anni); pregio € 5,00 – 8,00 senza sub-fasce e senza
 *   aumento per la durata; transitori con i valori del 3+2;
 * - sub-fascia dal punteggio delle dotazioni: almeno 6 punti = 1^, da 4,5
 *   a 5,5 = 2^, fino a 4 = 3^. Studenti (allegato 3): almeno 4 delle 7
 *   dotazioni = 1^, 3 = 2^, 2 = 3^; senza servizio igienico interno 3^;
 * - superficie utile convenzionale: abitazione 100%, box 80%, cantine,
 *   soffitte, balconi e terrazze 25%, aree scoperte 10% (non oltre la
 *   superficie dell'alloggio), mansarde sotto 1,60 m 25%;
 * - fuori dal pregio, maggiorazione dei mq (cap. IX, lettera A): fino a 41
 *   mq +30%, fino a 51 +25%, fino a 67 +20%, fra 67 e 80 almeno 80,4 mq;
 * - maggiorazioni B-J (cap. IX) sommate fra loro e applicate al canone base.
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.CanoneTorino = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const numero = (x) => {
    if (x === null || x === undefined) return null;
    const s = String(x).trim().replace(/\s/g, "");
    if (!s) return null;
    const n = Number(/,/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s);
    return Number.isFinite(n) ? n : null;
  };
  const cent = (n) => Math.round(n * 100) / 100;
  const virgola = (n, c = 2) => (n === null || n === undefined ? "" :
    Number(n).toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }));

  /** Il punteggio delle dotazioni: ogni gruppo con alternative vale una volta sola. */
  function punteggio(accordo, el, serviziExtra) {
    let punti = 0, elementi = 0;
    const presi = {};
    for (const [codice, gruppo, , valore] of accordo.elementi) {
      if (!el[codice]) continue;
      if (gruppo) { if (presi[gruppo] !== undefined && presi[gruppo] >= valore) continue; if (presi[gruppo] !== undefined) { punti -= presi[gruppo]; elementi--; } presi[gruppo] = valore; }
      punti += valore; elementi++;
    }
    const extra = Math.max(0, Math.floor(numero(serviziExtra) || 0));
    if (extra) { punti += extra * 0.5; elementi += extra; }
    return { punti, elementi };
  }

  function calcola(accordo, s) {
    const R = accordo.regole, C = R.correttivi, avvisi = [];
    const tipo = s.tipo || "agevolato";
    const r = { avvisi, zona: s.zona || null, zona_calcolo: null, pregio: false, sub: null, punti: 0, elementi: 0, fascia: null,
      righe: [], superficie: null, piccoli_perc: 0, mq_convenzionali: null, valore: null, valore_proposto: null,
      correttivi: [], totale_perc: 0, canone_base: null, canone: null, canone_massimo: null, canone_pattuito: null };

    // ------------------------------------------------------------ superficie
    const sup = s.superfici || {};
    let tot = 0, qualcosa = false, abitazione = 0;
    for (const riga of R.superficie) {
      const mq = numero(sup[riga.chiave]);
      let conv = mq === null ? null : mq * riga.coeff;
      if (riga.chiave === "abitazione" && mq !== null) abitazione = mq;
      r.righe.push({ chiave: riga.chiave, etichetta: riga.etichetta, coeff: riga.coeff, mq, convenzionale: conv });
    }
    // le aree scoperte non oltre la superficie dell'alloggio (esclusi i balconi)
    const scoperta = r.righe.find((x) => x.chiave === "scoperta");
    if (scoperta.convenzionale !== null && scoperta.convenzionale > abitazione) { scoperta.convenzionale = abitazione; avvisi.push("Le aree scoperte contano al massimo quanto la superficie dell'alloggio."); }
    for (const x of r.righe) { if (x.convenzionale !== null) { tot += x.convenzionale; qualcosa = true; x.convenzionale = cent(x.convenzionale); } }
    r.superficie = qualcosa ? cent(tot) : null;

    // parziale (cap. IV e V): esclusivi al 100%, condivisi al 50%
    const parziale = !!s.parziale;
    if (parziale) {
      const esc = numero(s.mq_esclusivi), con = numero(s.mq_condivisi);
      r.superficie = esc === null && con === null ? null : cent((esc || 0) + (con || 0) * 0.5);
    }

    // ------------------------------------------------------------ zona
    const zona = r.zona;
    r.pregio = zona === "P";
    if (r.pregio && s.area_pregio) r.zona_calcolo = String(s.area_pregio);       // criteri della microzona (lettera K)
    else if (r.pregio && !(s.elementi || {})["13"] && tipo !== "studenti") {
      avvisi.push("Zona di pregio senza servizio igienico interno: il canone si calcola con i criteri dell'area in cui si trova l'immobile. Indicala qui sotto.");
    }
    const usaPregio = r.pregio && !r.zona_calcolo;
    if (!r.pregio && zona) r.zona_calcolo = zona;

    // ------------------------------------------------------- sub-fascia
    const el = s.elementi || {};
    if (tipo === "studenti") {
      const n = (s.elementi_studenti || []).filter(Boolean).length;
      r.elementi = n;
      const [s1, s2, s3] = R.studenti_sub;
      r.sub = n >= s1 ? 1 : n >= s2 ? 2 : n >= s3 ? 3 : null;
      if (r.sub === null) { r.sub = 3; avvisi.push("Per i contratti per studenti servono almeno 2 delle dotazioni dell'allegato 3: con meno, la scheda usa la 3^ sub-fascia; verifica con l'associazione."); }
      if (!s.servizio_interno) { r.sub = 3; avvisi.push("Senza servizio igienico interno il canone per studenti è quello della 3^ sub-fascia."); }
    } else {
      const p = punteggio(accordo, el, s.servizi_extra);
      r.punti = p.punti; r.elementi = p.elementi;
      r.sub = p.punti >= R.sub_punti[0] ? 1 : p.punti >= R.sub_punti[1] ? 2 : 3;
    }

    // ------------------------------------------------------------ valori
    const anni = tipo === "agevolato" ? String(Math.min(6, Math.max(3, Number(s.durata_anni) || 3))) : "3";
    if (usaPregio) r.fascia = [R.pregio[1], R.pregio[0]];
    else if (r.zona_calcolo) {
      const tab = tipo === "studenti" ? R.valori_studenti : R.valori[anni];
      const [mx, mn] = tab[r.zona_calcolo][r.sub - 1];
      r.fascia = [mn, mx];
    }
    if (r.pregio && anni !== "3" && usaPregio) avvisi.push("In zona di pregio la durata oltre i 3 anni non aumenta il canone.");
    if (tipo === "studenti" && s.edisu && r.fascia) { r.fascia = [r.fascia[0], r.fascia[0]]; avvisi.push("Con la garanzia dell'EDISU i valori sono quelli minimi della fascia."); }

    // -------------------------------------- maggiorazione dei mq (lettera A)
    if (r.superficie !== null) {
      let mq = r.superficie;
      if (!usaPregio && !parziale) {
        const fascia = R.piccoli.find(([fino]) => r.superficie <= fino);
        if (fascia) { r.piccoli_perc = fascia[1]; mq = r.superficie * (1 + fascia[1] / 100); }
        else if (r.superficie < 80) { r.minimo_80 = true; mq = Math.max(r.superficie, R.minimo_67_80); }
      }
      r.mq_convenzionali = cent(mq);
    }

    // -------------------------------------------------------- correttivi
    const corr = s.correttivi || {};
    const aggiungi = (nome, perc) => { if (perc) r.correttivi.push({ nome, percento: perc }); };
    if (parziale) {
      const n = Math.max(1, Math.floor(numero(s.inquilini) || 1));
      if (n > 1 && !s.minori) aggiungi(`${n - 1} coabitant${n - 1 > 1 ? "i" : "e"} oltre il primo`, (n - 1) * C.parziale_coabitante);
    } else if (!r.pregio || r.zona_calcolo) {
      // B (costruito negli ultimi 8 anni) e D (classe energetica) non si sommano: vale la piu' alta
      const classe = s.classe || "", percClasse = C.classe[classe] || 0;
      const nuovo = Math.min(C.nuovo_8_anni, Math.abs(numero(corr.nuovo_8_anni) || 0));
      if (nuovo && percClasse > 0) {
        avvisi.push("La maggiorazione per la classe energetica non si somma a quella per gli stabili costruiti negli ultimi 8 anni: la scheda tiene la più alta.");
        if (nuovo >= percClasse) aggiungi("stabile costruito negli ultimi 8 anni", nuovo); else aggiungi(`classe energetica ${classe}`, percClasse);
      } else { aggiungi("stabile costruito negli ultimi 8 anni", nuovo); aggiungi(`classe energetica ${classe}`, percClasse); }
      aggiungi("ristrutturazione negli ultimi 10 anni", Math.min(C.ristrutturato, numero(corr.ristrutturato) || 0));
      if (s.arredo_acquistato) aggiungi("arredo acquistato negli ultimi 5 anni (almeno € 5.000)", C.arredo_acquistato);
      if (s.senza_deposito) aggiungi("nessun deposito cauzionale", C.senza_deposito);
      if (tipo === "agevolato") {
        if (s.recesso_3_mesi) aggiungi("recesso del conduttore con 3 mesi di preavviso", C.recesso_3_mesi);
        if (s.arredo === "completo") aggiungi("alloggio completamente arredato", C.arredato);
        else if (s.arredo === "cucina") aggiungi("arredo cucina completo con frigorifero e lavatrice", C.cucina);
        if (s.arredo && s.arredo !== "no" && el["17"]) avvisi.push("Con la maggiorazione per l'arredo non si conta l'elemento 17: toglilo dalle dotazioni.");
      }
      if ((tipo === "agevolato" || tipo === "transitorio") && s.elementi_9) {
        if (r.elementi >= 9 && r.punti >= 8) aggiungi("almeno 9 elementi (almeno 8 punti)", C.elementi_9);
        else avvisi.push("La maggiorazione del 10% richiede almeno 9 elementi che pesino almeno 8 punti.");
      }
    }
    if (!parziale && tipo === "transitorio" && s.arredo === "camera") aggiungi("ammobiliato (almeno cucina e camera da letto)", C.transitorio_arredo);
    if (!parziale && tipo === "studenti" && s.arredo === "camera") aggiungi("ammobiliato (almeno cucina e camera da letto)", C.studenti_arredo);
    if ((tipo !== "agevolato") && s.arredo === "camera" && el["17"]) avvisi.push("Con l'aumento per l'arredo non si conta l'elemento 17: toglilo dalle dotazioni.");
    r.totale_perc = cent(r.correttivi.reduce((t, c) => t + c.percento, 0));

    // ------------------------------------------------------------ canone
    if (r.fascia) {
      r.valore_proposto = r.fascia[1];
      const scritto = numero(s.valore_mq);
      r.valore = scritto !== null ? scritto : r.valore_proposto;
      if (scritto !== null && scritto > r.fascia[1] + 0.005) avvisi.push(`Il valore al mq supera il massimo della fascia (€ ${virgola(r.fascia[1])}).`);
      if (scritto !== null && scritto < r.fascia[0] * (1 - C.riduzione_minimi / 100) - 0.005) avvisi.push(`Il valore al mq è sotto il minimo (€ ${virgola(r.fascia[0])}, riducibile fino al 10% solo nei casi previsti e con doppia vidimazione).`);
      else if (scritto !== null && scritto < r.fascia[0] - 0.005) avvisi.push("Sotto il minimo: possibile fino al 10% solo per edifici degradati, locazione a parenti o affini entro il terzo grado o contratti Lo.C.A.Re., motivandolo nel contratto e con la vidimazione di un'associazione dei proprietari e di una degli inquilini.");
      if (r.mq_convenzionali) {
        r.canone_base = cent(r.mq_convenzionali * r.valore);
        r.canone = cent(r.canone_base * (1 + r.totale_perc / 100));
        r.canone_massimo = cent(r.mq_convenzionali * r.fascia[1] * (1 + r.totale_perc / 100));
      }
    }
    if (!zona) avvisi.push("Scegli la zona: scrivi la via e la trovi dall'elenco viario dell'accordo.");
    if (qualcosa && numero(sup.abitazione) === null && !parziale) avvisi.push("Inserisci i mq utili dell'abitazione.");
    const pattuito = numero(s.canone_mensile);
    if (pattuito !== null) {
      r.canone_pattuito = pattuito;
      if (r.canone_massimo !== null && pattuito > r.canone_massimo + 0.005) avvisi.push(`Il canone pattuito supera il massimo (€ ${virgola(r.canone_massimo)} al mese).`);
    }
    return r;
  }

  return { calcola, punteggio, numero, virgola };
});

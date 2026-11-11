/*
 * Il calcolo del canone concordato secondo l'Accordo territoriale per il
 * Comune di Napoli del 29 aprile 2025 (depositato il 24/07/2025). Dati in
 * accordi/napoli-2025-04-29.json. Gira nel browser e con Node (prove).
 *
 *   CanoneNapoli.calcola(accordo, scheda) -> risultato
 *
 * Come funziona l'accordo:
 * - 7 aree, dall'allegato A per sezione urbana e foglio catastale; alcune
 *   strade di pregio sono "rimodulate" e valgono come l'area superiore;
 * - valori ANNUI in €/mq, minimo e massimo per area (allegato B);
 * - 4 fasce della banda minimo-massimo (allegato C): 1^ dall'1 al 25%,
 *   2^ dal 26 al 50%, 3^ dal 51 al 75%, 4^ dal 76 al 100%; fino a 3 dei
 *   22 elementi = 1^, almeno 4 = 2^, almeno 5 = 3^, almeno 6 = 4^; classe
 *   energetica A con APE dopo l'1/1/2013 = 4^. Dentro la fascia il valore
 *   va dal minimo (stato "mediocre") al medio ("normale") al massimo
 *   ("ottimo"); in 4^ fascia senza tutte le condizioni (stato almeno
 *   normale, 6 elementi) si resta al minimo della fascia;
 * - superficie convenzionale con i coefficienti dell'allegato C (verde
 *   condominiale: mq × millesimi/1000 × 0,10);
 * - maggiorazioni e riduzioni in percentuale del valore al mq annuo
 *   (allegato B e scheda H): si sommano, gli aumenti non oltre il 100%.
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.CanoneNapoli = fabbrica();
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

  const SEZIONI = (accordo) => [...new Set(Object.keys(accordo.fogli).map((k) => k.split("/")[0]))].sort();

  /** L'area dal foglio catastale e le strade di pregio di quel foglio. */
  function areaDaFoglio(accordo, sezione, foglio) {
    const f = parseInt(foglio, 10);
    const area = accordo.fogli[`${String(sezione || "").toUpperCase()}/${f}`] || null;
    const strade = area ? accordo.strade_pregio
      .map((e, i) => Object.assign({ i }, e))
      .filter((e) => e.sezione === String(sezione).toUpperCase() && e.fogli.includes(f)) : [];
    return { area, strade };
  }

  /** L'aumento per le case piccole (allegato B): 35-36 mq +44%, 36-37 +43%… fino a 0 a 80 mq, al massimo 50%. */
  const piccoliMassimo = (accordo, mq) => {
    const C = accordo.regole.correttivi;
    if (mq === null || mq >= C.piccoli_soglia) return 0;
    return Math.max(0, Math.min(C.piccoli_massimo, C.piccoli_soglia - 1 - Math.floor(mq)));
  };

  function calcola(accordo, s) {
    const R = accordo.regole, C = R.correttivi, avvisi = [];
    const r = { avvisi, area: null, area_foglio: null, strada: null, valori: null, elementi: 0, fascia: null, fascia_valori: null,
      solo_minimo: false, valore_proposto: null, valore: null, correttivi: [], totale_perc: 0, valore_applicato: null,
      righe: [], verde: null, totale: null, superficie_locata: null, canone_annuo: null, canone_massimo: null,
      canone_massimo_annuo: null, canone_pattuito: null, canone_pattuito_annuo: null };

    // ------------------------------------------------ area e strada di pregio
    const { area, strade } = areaDaFoglio(accordo, s.sezione, s.foglio);
    r.area_foglio = area;
    r.strade_foglio = strade;
    if (s.sezione && s.foglio && !area) avvisi.push(`Il foglio ${s.foglio} della sezione ${s.sezione} non è nell'allegato A: controlla sezione e foglio sulla visura.`);
    const scelta = s.strada !== "" && s.strada !== undefined && s.strada !== null && s.strada !== "nessuna"
      ? strade.find((e) => String(e.i) === String(s.strada)) || null : null;
    r.strada = scelta;
    r.area = area ? (scelta && scelta.rimodulata ? Math.max(area, scelta.area) : area) : null;
    if (r.area) r.valori = R.aree[String(r.area)].slice();

    // ------------------------------------------------------------ superficie
    const sup = s.superfici || {};
    let totale = 0, qualcosa = false;
    for (const riga of R.superficie) {
      const mq = numero(sup[riga.chiave]);
      const conv = mq === null ? null : mq * riga.coeff;
      if (conv !== null) { totale += conv; qualcosa = true; }
      r.righe.push({ chiave: riga.chiave, etichetta: riga.etichetta, coeff: riga.coeff, mq, convenzionale: conv === null ? null : cent(conv) });
    }
    const vMq = numero(s.verde_mq), vMill = numero(s.verde_millesimi);
    if (vMq !== null && vMill !== null) { r.verde = cent(vMq * vMill / 1000 * R.verde_condominiale); totale += vMq * vMill / 1000 * R.verde_condominiale; qualcosa = true; }
    r.totale = qualcosa ? cent(totale) : null;
    const locata = s.parziale ? numero(s.superficie_locata) : null;
    r.superficie_locata = s.parziale ? (locata !== null ? locata : r.totale) : r.totale;
    if (s.parziale && locata === null && r.totale) avvisi.push("Locazione parziale: indica la superficie della porzione locata, compresa la quota di parti e servizi in comune (art. 5).");

    // ---------------------------------------------------------------- fascia
    const el = s.elementi || [];
    r.elementi = el.filter(Boolean).length;
    const soglie = R.fasce_elementi;
    let fascia = 1;
    for (let k = soglie.length - 1; k >= 1; k--) if (r.elementi >= soglie[k]) { fascia = k + 1; break; }
    const classeA = s.classe === "A" && s.classe_A_2013;
    if (classeA && fascia < 4) { fascia = 4; r.fascia_da_classe = true; }
    r.fascia = fascia;
    if (r.valori) {
      const [mn, mx] = r.valori, banda = mx - mn, [da, a] = R.fasce[fascia - 1];
      r.fascia_valori = [cent(mn + banda * da / 100), cent(mn + banda * a / 100)];
      const [fmin, fmax] = r.fascia_valori;
      r.solo_minimo = fascia === 4 && (s.stato === "mediocre" || r.elementi < soglie[3]);
      r.valore_proposto = r.solo_minimo ? fmin : s.stato === "ottimo" ? fmax : s.stato === "mediocre" ? fmin : cent((fmin + fmax) / 2);
      const scritto = numero(s.valore_mq);
      r.valore = scritto !== null ? scritto : r.valore_proposto;
      const tetto = r.solo_minimo ? fmin : fmax;
      if (scritto !== null && scritto > tetto + 0.005) avvisi.push(`Il valore al mq supera il massimo della fascia (€ ${virgola(tetto)}).`);
      if (scritto !== null && scritto < fmin - 0.005) avvisi.push(`Il valore al mq è sotto il minimo della fascia (€ ${virgola(fmin)}).`);
      if (r.solo_minimo) avvisi.push(r.elementi < soglie[3]
        ? "Classe energetica A: la fascia è la 4^, ma senza almeno sei elementi il canone si concorda al minimo della 4^ fascia."
        : "In 4^ fascia lo stato di conservazione deve essere almeno \"normale\": altrimenti il canone si concorda al minimo della fascia.");
    }

    // ------------------------------------------------------------- correttivi
    const corr = s.correttivi || {};
    const aggiungi = (nome, perc, max, segno = 1, min = 0) => {
      let p = numero(perc);
      if (p === null || p === 0) return;
      p = Math.abs(p);
      if (p > max) { avvisi.push(`${nome}: al massimo ${max}%.`); p = max; }
      if (min && p < min) { avvisi.push(`${nome}: almeno ${min}%.`); p = min; }
      r.correttivi.push({ nome, percento: segno * p });
    };
    const tipo = s.tipo || "agevolato";
    if (s.arredo === "completo") aggiungi("ammobiliato", corr.arredo, tipo === "transitorio" ? C.arredato_transitorio : C.arredato);
    else if (s.arredo === "parziale") {
      if (tipo === "agevolato") aggiungi("parzialmente ammobiliato", corr.arredo, C.parz_arredato);
      else avvisi.push("L'aumento per l'alloggio parzialmente ammobiliato è previsto solo per i contratti ordinari (3+2).");
    }
    if (tipo === "agevolato") {
      const anni = Number(s.durata_anni) || 3;
      const p = Math.min(C.durata_massimo, Math.max(0, anni - 3) * C.durata_per_anno);
      if (p) r.correttivi.push({ nome: `durata ${anni} anni`, percento: p });
    }
    if (tipo === "transitorio") aggiungi("contratto transitorio", corr.transitorio, C.transitorio);
    aggiungi("ampia veduta libera", corr.veduta, C.veduta);
    if (scelta) {
      const lim = C.pregio_area[String(r.area)] || 0;
      const p = numero(corr.pregio);
      // aree 3 e 4: solo aumento; aree 5, 6 e 7: aumento o riduzione (elenchi dell'allegato A)
      if (p && p < 0 && r.area < 5) avvisi.push(`In area ${r.area} la strada di pregio può solo aumentare il canone.`);
      else if (p) aggiungi("strada di pregio", Math.abs(p), lim, p < 0 ? -1 : 1);
    } else if (s.strada === "nessuna") aggiungi("strada non di pregio", corr.non_pregio, C.non_pregio, -1);
    const S = r.totale;
    const autoPiccoli = piccoliMassimo(accordo, S);
    r.piccoli_massimo = autoPiccoli;
    if (autoPiccoli) {
      const scrittoP = numero(corr.piccoli);
      aggiungi("superficie inferiore a 80 mq", scrittoP === null ? autoPiccoli : scrittoP, autoPiccoli);
    }
    if (S !== null && S > C.grandi_soglia) aggiungi("superficie superiore a 130 mq", corr.grandi, C.grandi, -1);
    aggiungi("impianti di risparmio energetico", corr.risparmio, C.risparmio);
    aggiungi("area giardinata", corr.giardino, C.giardino);
    if (s.basso) aggiungi("\"basso napoletano\"", corr.basso === undefined || corr.basso === "" ? C.basso[0] : corr.basso, C.basso[1], -1, C.basso[0]);

    const aumenti = r.correttivi.filter((c) => c.percento > 0).reduce((t, c) => t + c.percento, 0);
    const riduzioni = r.correttivi.filter((c) => c.percento < 0).reduce((t, c) => t + c.percento, 0);
    if (aumenti > C.totale_massimo) avvisi.push(`Gli aumenti sommati (${aumenti}%) non possono superare il ${C.totale_massimo}%: la scheda li ferma al ${C.totale_massimo}%.`);
    r.totale_perc = Math.min(aumenti, C.totale_massimo) + riduzioni;

    // ---------------------------------------------------------------- canone
    if (r.valore !== null) {
      r.valore_applicato = cent(r.valore * (1 + r.totale_perc / 100));
      const tetto = r.solo_minimo ? r.fascia_valori[0] : r.fascia_valori[1];
      const massimoMq = tetto * (1 + r.totale_perc / 100);
      if (r.superficie_locata) {
        r.canone_annuo = cent(r.valore * (1 + r.totale_perc / 100) * r.superficie_locata);
        r.canone_massimo_annuo = cent(massimoMq * r.superficie_locata);
        r.canone_massimo = cent(r.canone_massimo_annuo / 12);
      }
    }
    if (!s.sezione || !s.foglio) avvisi.push("Indica sezione urbana e foglio catastale (dalla visura): servono per trovare l'area.");
    if (qualcosa && numero(sup.utile) === null) avvisi.push("Inserisci la superficie utile abitabile.");
    const annuo = numero(s.canone_annuo);
    if (annuo !== null) {
      r.canone_pattuito_annuo = annuo; r.canone_pattuito = cent(annuo / 12);
      if (r.canone_massimo_annuo !== null && annuo > r.canone_massimo_annuo + 0.005)
        avvisi.push(`Il canone pattuito supera il massimo (€ ${virgola(r.canone_massimo_annuo)} l'anno).`);
    }
    return r;
  }

  return { calcola, areaDaFoglio, piccoliMassimo, SEZIONI, numero, virgola };
});

/*
 * Il calcolo del canone concordato secondo l'Accordo applicabile nel
 * territorio metropolitano di Bologna (firmato il 27/03/2024, depositato il
 * 28/03/2024 P.G. 20926), per il Comune di Bologna. Dati in
 * accordi/bologna-2024-03-28.json. Gira nel browser e con Node.
 *
 *   CanoneBologna.calcola(accordo, scheda) -> risultato
 *
 * Come funziona l'accordo (artt. 2-7, allegato 1):
 * - tre zone (pregio, A, B: allegato 5) e il numero di vani abitabili
 *   (monolocale, 2, 3, 4, 5, oltre 5) danno tre fasce, in euro al mq
 *   all'anno; la fascia dipende dai 18 parametri: fino a 3 la minima, da 4
 *   a 7 la media, oltre 7 la massima;
 * - superficie convenzionale (art. 5): la catastale escluse le aree scoperte
 *   meno il 10% se comprende la cantina, meno il 5% se no; oppure la
 *   superficie interna dalla pianta. In più: autorimessa C6 al 50%, posto
 *   auto al 20%, terrazzo o balcone e area verde esclusiva oltre 10 mq al 10%;
 *   per una porzione, la quota A / (A + B);
 * - maggiorazioni sommate e applicate una volta sola (art. 7): pregio +8%,
 *   arredo fino a +13% (+15% con mobili degli ultimi due anni), durata 4, 5,
 *   6 anni +5/8/12%, deposito fino a una mensilità +5%, recesso libero con
 *   preavviso fino a tre mesi +5%, classe energetica A-B +12% o C-D +7%.
 *   Transitori senza durata, deposito e recesso; studenti senza durata.
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.CanoneBologna = fabbrica();
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

  /** La superficie convenzionale (art. 5). */
  function superficie(accordo, s) {
    const R = accordo.regole.superficie, sup = s.superfici || {}, note = [];
    const mq = numero(sup.alloggio);
    if (mq === null) return null;
    const righe = [];
    let alloggio = mq;
    if (s.fonte_sup !== "interna") {
      const p = s.con_cantina ? R.catastale_con_cantina : R.catastale_senza_cantina;
      alloggio = mq * (1 - p);
      note.push(`Superficie catastale ${virgola(mq)} mq meno il ${Math.round(p * 100)}% (${s.con_cantina ? "comprende la cantina" : "senza cantina"}).`);
    }
    righe.push({ chiave: "alloggio", mq, convenzionale: cent(alloggio) });
    const oltre = (x, [soglia, p]) => (x > soglia ? x * p : 0);
    const aut = numero(sup.autorimessa) || 0, pa = numero(sup.posto_auto) || 0, ter = numero(sup.terrazzo) || 0, ver = numero(sup.verde) || 0;
    righe.push({ chiave: "autorimessa", mq: aut, convenzionale: cent(aut * R.autorimessa) });
    righe.push({ chiave: "posto_auto", mq: pa, convenzionale: cent(pa * R.posto_auto) });
    righe.push({ chiave: "terrazzo", mq: ter, convenzionale: cent(oltre(ter, R.terrazzo)) });
    righe.push({ chiave: "verde", mq: ver, convenzionale: cent(oltre(ver, R.verde)) });
    if (ter && ter <= R.terrazzo[0]) note.push("Terrazzo o balcone fino a 10 mq: non si conta.");
    if (ver && ver <= R.verde[0]) note.push("Area verde fino a 10 mq: non si conta.");
    const totale = cent(righe.reduce((t, r) => t + r.convenzionale, 0));
    const r = { righe, totale, locata: totale, quota: null, note };
    if (s.porzione) {
      const A = numero(s.mq_conduttore), B = numero(s.mq_altri) || 0;
      if (A !== null && A + B > 0) {
        r.quota = A / (A + B);
        r.locata = cent(totale * r.quota);
        note.push(`Porzione: ${virgola(A)} mq su ${virgola(A + B)} (${virgola(r.quota * 100)}%) della superficie convenzionale.`);
      } else note.push("Porzione: indica i mq usati dal conduttore e quelli del locatore o di altri.");
    }
    return r;
  }

  function calcola(accordo, s) {
    const R = accordo.regole, avvisi = [];
    const tipo = s.tipo || "agevolato";
    const r = { avvisi, zona: null, vani: null, elementi: 0, fascia_n: 0, fascia: null, superficie: null,
      maggiorazioni: [], percento: 0, fascia_magg: null, valore: null, valore_proposto: null,
      canone_minimo: null, canone: null, canone_massimo: null, canone_pattuito: null };

    r.zona = R.zone.find((z) => z[0] === s.zona) || null;
    r.vani = R.vani.find((z) => z[0] === s.vani) || null;
    r.elementi = (s.elementi || []).filter(Boolean).length;
    const [f1, f2] = R.fasce.fino;
    r.fascia_n = r.elementi <= f1 ? 0 : r.elementi <= f2 ? 1 : 2;
    r.fascia_nome = R.fasce.nomi[r.fascia_n];
    if (!r.zona) avvisi.push("Scegli la zona.");
    if (!r.vani) avvisi.push("Indica il numero di vani abitabili.");
    if (r.zona && r.vani) r.fascia = R.tariffe[r.zona[0]][r.vani[0]][r.fascia_n];

    const M = R.maggiorazioni, esclusi = R.esclusi[tipo] || [];
    const add = (chiave, nome, percento) => { if (percento && !esclusi.includes(chiave)) r.maggiorazioni.push({ chiave, nome, percento }); };
    if (s.pregio) add("pregio", "immobile di pregio", M.pregio);
    if (s.arredo) add("arredo", s.arredo === "nuovo" ? "arredato, mobili degli ultimi 2 anni" : "arredato", s.arredo === "nuovo" ? M.arredo_nuovo : M.arredo);
    if (tipo === "agevolato") { const anni = String(s.durata_anni || 3); add("durata", `durata ${anni} + 2 anni`, M.durata[anni] || 0); }
    if (s.deposito) add("deposito", "deposito fino a una mensilità", M.deposito);
    if (s.recesso) add("recesso", "recesso libero", M.recesso);
    if (s.energia === "ab") add("energia", "classe energetica A o B", M.energia_ab);
    if (s.energia === "cd") add("energia", "classe energetica C o D", M.energia_cd);
    r.percento = r.maggiorazioni.reduce((t, m) => t + m.percento, 0);
    if (r.fascia) r.fascia_magg = r.fascia.map((x) => cent(x * (1 + r.percento / 100)));

    const sup = superficie(accordo, s);
    r.superficie = sup;
    if (sup) avvisi.push(...sup.note); else avvisi.push("Inserisci la superficie dell'alloggio.");

    if (r.fascia_magg) {
      r.valore_proposto = r.fascia_magg[1];
      const scritto = numero(s.valore_mq);
      r.valore = scritto !== null ? scritto : r.valore_proposto;
      if (scritto !== null && scritto > r.fascia_magg[1] + 0.005) avvisi.push(`Il valore al mq supera il massimo della fascia (€ ${virgola(r.fascia_magg[1])} l'anno).`);
      if (scritto !== null && scritto < r.fascia_magg[0] - 0.005) avvisi.push(`Il valore al mq è sotto il minimo della fascia (€ ${virgola(r.fascia_magg[0])}): serve una condizione particolare scritta e convalidata dalle associazioni (art. 6).`);
      if (sup) {
        const mq = sup.locata;
        r.canone_minimo = cent(mq * r.fascia_magg[0] / 12);
        r.canone_massimo = cent(mq * r.fascia_magg[1] / 12);
        r.canone = cent(mq * r.valore / 12);
      }
    }
    if (r.fascia_n === 2 && r.valore !== null && r.fascia && Math.abs(r.valore - r.fascia_magg[1]) < 0.005)
      avvisi.push("Il massimo della fascia massima si applica con almeno 8 parametri e stato di manutenzione ottimo (art. 6).");
    const pattuito = numero(s.canone_mensile);
    if (pattuito !== null) {
      r.canone_pattuito = pattuito;
      if (r.canone_massimo !== null && pattuito > r.canone_massimo + 0.005) avvisi.push(`Il canone pattuito supera il massimo (€ ${virgola(r.canone_massimo)} al mese).`);
      if (r.canone_minimo !== null && pattuito < r.canone_minimo - 0.005) avvisi.push(`Il canone pattuito è sotto il minimo (€ ${virgola(r.canone_minimo)} al mese).`);
    }
    return r;
  }

  return { calcola, superficie, numero, virgola };
});

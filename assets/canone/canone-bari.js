/*
 * Il calcolo del canone concordato secondo l'Accordo territoriale per il
 * Comune di Bari firmato il 13 marzo 2024 (depositato il 26/03/2024, in vigore
 * dal 2/5/2024). Dati in accordi/bari-2024-03-13.json. Gira nel browser e
 * con Node.
 *
 *   CanoneBari.calcola(accordo, scheda) -> risultato
 *
 * Come funziona l'accordo:
 * - 13 zone per fogli catastali (allegato 1), valori MENSILI al mq; in ogni
 *   zona tre o quattro fasce (A, B, C, D) secondo quanti dei 30 elementi ha
 *   l'alloggio. Le soglie scritte nell'allegato ("oltre sette", "fino a
 *   sette", "almeno cinque"...) sono lette come fasce contigue: es. Murat
 *   A da 8, B 7, C 5-6, D fino a 4 (regole.zone, colonna "da elementi");
 * - zone di pregio (zone 1, 2, 3): con i requisiti indicati, fascia A;
 * - arredo: già in fascia A +10% (parziale) o +20% (totale); in fascia B o C
 *   con riscaldamento, autoclave e infissi in buono stato si passa in A
 *   (totale: fino a +10%);
 * - superficie convenzionale (punto 2): utile + autorimessa 50% + posto auto
 *   25% + balconi, terrazze, cortili, cantine 25% + scoperto esclusivo 15% +
 *   quota di verde 10%; vani sotto 170 cm al 50%; oltre 130 mq l'eccedenza
 *   al 50%; fino a 45 mq x 1,20 (massimo 45), da 46 a 70 mq x 1,20 (massimo 70);
 * - classe energetica A +5%, da B a F +3%; poi, in modo progressivo,
 *   l'arredo e la durata (4, 5, 6 anni +5/7/12%); porzione in proporzione.
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.CanoneBari = fabbrica();
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

  function superficie(accordo, s) {
    const R = accordo.regole.superficie, sup = s.superfici || {};
    const U = numero(sup.utile);
    if (U === null) return null;
    const n = (k) => numero(sup[k]) || 0, note = [];
    const voci = [["utile", U, U], ["basse", n("basse"), n("basse") * R.basse], ["autorimessa", n("autorimessa"), n("autorimessa") * R.autorimessa],
      ["posto_auto", n("posto_auto"), n("posto_auto") * R.posto_auto], ["accessori", n("accessori"), n("accessori") * R.accessori],
      ["scoperta", n("scoperta"), n("scoperta") * R.scoperta], ["verde", n("verde"), n("verde") * R.verde]];
    const righe = voci.map(([chiave, mq, c]) => ({ chiave, mq, convenzionale: cent(c) }));
    const lorda = cent(righe.reduce((t, r) => t + r.convenzionale, 0));
    let totale = lorda;
    const [[s1, k1, m1], [s2, k2, m2]] = R.piccoli, [soglia, p] = R.grandi;
    if (lorda <= s1) totale = Math.max(lorda, Math.min(lorda * k1, m1));
    else if (lorda <= s2) totale = Math.max(lorda, Math.min(lorda * k2, m2));
    else if (lorda > soglia) { totale = soglia + (lorda - soglia) * p; note.push("Oltre 130 mq la parte eccedente conta il 50%."); }
    if (totale > lorda) note.push(`Fino a ${lorda <= s1 ? s1 : s2} mq: superficie x 1,20, al massimo ${lorda <= s1 ? m1 : m2} mq.`);
    return { righe, lorda, totale: cent(totale), note };
  }

  function calcola(accordo, s) {
    const R = accordo.regole, avvisi = [];
    const tipo = s.tipo || "agevolato";
    const r = { avvisi, zona: null, elementi: 0, fascia: null, fascia_per_elementi: null, promossa: "", superficie: null,
      maggiorazioni: [], fattore: 1, fascia_magg: null, valore: null, valore_proposto: null,
      canone_intero: null, canone_minimo: null, canone: null, canone_massimo: null, canone_pattuito: null, quota: null };
    r.zona = R.zone.find((z) => z[0] === String(s.zona || "")) || null;
    const el = s.elementi || [];
    r.elementi = el.filter(Boolean).length;
    if (!r.zona) avvisi.push("Scegli la zona.");
    else {
      const fasce = r.zona[3];
      let f = fasce.find((x) => r.elementi >= x[1]);
      r.fascia_per_elementi = f[0];
      const requisiti = R.requisiti_promozione.every((i) => el[i]);
      if (s.pregio && r.zona[4]) { f = fasce[0]; r.promossa = "zona di pregio"; }
      else if (s.arredo && (f[0] === "B" || f[0] === "C")) {
        if (requisiti) { f = fasce[0]; r.promossa = `arredato ${s.arredo === "totale" ? "totalmente" : "in parte"}`; }
        else avvisi.push("Arredato in fascia B o C: passa in fascia A solo con riscaldamento, autoclave e infissi in buono stato.");
      }
      r.fascia = f;
    }
    const add = (nome, percento) => { if (percento) r.maggiorazioni.push({ nome, percento }); };
    if (s.energia === "A") add("classe energetica A", R.energia.A);
    else if (s.energia === "BF") add("classe energetica da B a F", R.energia.altre);
    if (s.arredo && r.fascia && r.fascia[0] === "A") {
      if (r.promossa.startsWith("arredato")) { if (s.arredo === "totale") add("arredato totalmente (passato in fascia A)", Math.min(R.arredo.totale_promosso, numero(s.arredo_perc) ?? R.arredo.totale_promosso)); }
      else add(s.arredo === "totale" ? "arredato totalmente" : "arredato in parte", s.arredo === "totale" ? R.arredo.totale_in_a : R.arredo.parziale_in_a);
    }
    if (tipo === "agevolato") { const anni = String(Math.min(6, Number(s.durata_anni) || 3)); add(`durata ${s.durata_anni} + 2 anni`, R.durata[anni] || 0); }
    r.fattore = r.maggiorazioni.reduce((f, m) => f * (1 + m.percento / 100), 1);
    if (r.fascia) r.fascia_magg = [r.fascia[2], r.fascia[3]].map((x) => Math.round(x * r.fattore * 1000) / 1000);

    const sup = superficie(accordo, s);
    r.superficie = sup;
    if (sup) avvisi.push(...sup.note); else avvisi.push("Inserisci la superficie utile.");
    if (r.fascia_magg) {
      r.valore_proposto = r.fascia_magg[1];
      const scritto = numero(s.valore_mq);
      r.valore = scritto !== null ? scritto : r.valore_proposto;
      if (scritto !== null && scritto > r.fascia_magg[1] + 0.0005) avvisi.push(`Il valore al mq supera il massimo della fascia (€ ${virgola(r.fascia_magg[1], 3)} al mese).`);
      if (scritto !== null && scritto < r.fascia_magg[0] - 0.0005) avvisi.push(`Il valore al mq è sotto il minimo della fascia (€ ${virgola(r.fascia_magg[0], 3)} al mese).`);
      if (sup) {
        let k = 1;
        if (s.porzione) {
          const p = numero(s.mq_porzione);
          if (p !== null && sup.totale) { k = Math.min(1, p / sup.totale); r.quota = k; avvisi.push(`Porzione: ${virgola(p)} mq convenzionali su ${virgola(sup.totale)} (${virgola(k * 100)}%).`); }
          else avvisi.push("Porzione: indica i mq convenzionali della parte locata, comprese le parti in comune.");
        }
        r.canone_intero = cent(sup.totale * r.valore);
        r.canone = cent(r.canone_intero * k);
        r.canone_minimo = cent(sup.totale * r.fascia_magg[0] * k);
        r.canone_massimo = cent(sup.totale * r.fascia_magg[1] * k);
      }
    }
    const pattuito = numero(s.canone_mensile);
    if (pattuito !== null) {
      r.canone_pattuito = pattuito;
      if (r.canone_massimo !== null && pattuito > r.canone_massimo + 0.005) avvisi.push(`Il canone pattuito supera il massimo (€ ${virgola(r.canone_massimo)} al mese).`);
    }
    return r;
  }

  return { calcola, superficie, numero, virgola };
});

/*
 * Il calcolo del canone concordato secondo l'Accordo territoriale per il
 * Comune di Palermo depositato il 23 gennaio 2020. Dati in
 * accordi/palermo-2020-01-23.json. Gira nel browser e con Node.
 *
 *   CanonePalermo.calcola(accordo, scheda) -> risultato
 *
 * Come funziona l'accordo:
 * - 19 microzone (allegato B), valori MENSILI al mq utile;
 * - 3 sub-fasce dai 17 elementi (allegato C): fino a 5 = 1^, da 6 a 10 = 2^,
 *   oltre 10 = 3^; l'epoca di costruzione o di ristrutturazione totale
 *   sposta minimo e massimo: dopo il 2000 +8/+16/+28%, 1970-1999 +3/+6/+20%,
 *   prima del 1970 -10/+2/+15% (uguale nelle 19 tabelle);
 * - superficie (allegato D): vani principali 100%, accessori 50% se
 *   comunicanti o 25%, balconi e terrazze 30% fino a 25 mq e 10% oltre (15%
 *   e 5% se non comunicanti), area scoperta 10% fino alla superficie dei
 *   vani e 2% oltre; pertinenze al massimo metà dei vani principali; sotto
 *   i 50 mq x 1,25; oltre 120 mq la parte fino a 150 al 75%, oltre al 25%;
 * - aumenti (artt. 5, 6, 7) non cumulabili, vale il maggiore: durata 4, 5,
 *   6 + 2 anni +3/5/7%, totalmente ammobiliato fino a +15%, immobile
 *   storico totalmente ristrutturato fino a +40%.
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.CanonePalermo = fabbrica();
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

  /** La superficie utile secondo l'allegato D. */
  function superficie(accordo, s) {
    const R = accordo.regole.superficie, sup = s.superfici || {};
    const A = numero(sup.vani);
    if (A === null) return null;
    const righe = [];
    const accC = numero(sup.accessori_comunicanti) || 0, accN = numero(sup.accessori_non) || 0;
    const balC = numero(sup.balconi) || 0, balN = numero(sup.balconi_non) || 0, sco = numero(sup.scoperta) || 0;
    const scaglioni = (mq, [soglia, p1, p2]) => Math.min(mq, soglia) * p1 + Math.max(0, mq - soglia) * p2;
    const voci = [
      ["vani", "Superficie calpestabile appartamento", A, A],
      ["accessori_comunicanti", "Vani accessori comunicanti (soffitte, cantine, mezzanini, box) al 50%", accC, accC * R.accessori_comunicanti],
      ["accessori_non", "Vani accessori non comunicanti al 25%", accN, accN * R.accessori_non],
      ["balconi", "Balconi e terrazze comunicanti (30% fino a 25 mq, 10% oltre)", balC, scaglioni(balC, R.balconi)],
      ["balconi_non", "Balconi e terrazze non comunicanti (15% fino a 25 mq, 5% oltre)", balN, scaglioni(balN, R.balconi_non)],
      ["scoperta", "Area scoperta di pertinenza esclusiva (10% fino alla sup. dei vani, 2% oltre)", sco, Math.min(sco, A) * R.scoperta[0] + Math.max(0, sco - A) * R.scoperta[1]],
    ];
    for (const [chiave, etichetta, mq, conv] of voci) righe.push({ chiave, etichetta, mq, convenzionale: cent(conv) });
    const pertinenze = voci.slice(1).reduce((t, v) => t + v[3], 0);
    const tetto = A * R.pertinenze_massimo;
    const pertinenzeUsate = Math.min(pertinenze, tetto);
    let totale = A + pertinenzeUsate;
    const note = [];
    if (pertinenze > tetto) note.push(`Le pertinenze contano al massimo metà dei vani principali (${virgola(tetto)} mq).`);
    let lorda = totale;
    if (totale < R.piccoli[0]) { totale = totale * R.piccoli[1]; note.push(`Sotto i 50 mq la superficie si moltiplica per 1,25.`); }
    else if (totale > R.grandi[0][0]) {
      const [[da, a, p1], [, , p2]] = R.grandi;
      totale = da + (Math.min(totale, a) - da) * p1 + Math.max(0, totale - a) * p2;
      note.push("Oltre i 120 mq: la parte fino a 150 mq conta il 75%, quella oltre il 25%.");
    }
    return { righe, pertinenze: cent(pertinenze), pertinenze_usate: cent(pertinenzeUsate), lorda: cent(lorda), totale: cent(totale), note };
  }

  function calcola(accordo, s) {
    const R = accordo.regole, avvisi = [];
    const tipo = s.tipo || "agevolato";
    const r = { avvisi, microzona: null, elementi: 0, sub: null, epoca_perc: null, fascia_base: null, fascia: null,
      superficie: null, aumenti: [], aumento: null, valore: null, valore_proposto: null, canone_base: null, canone: null,
      canone_massimo: null, canone_pattuito: null };

    r.microzona = R.microzone.find((m) => m[0] === String(s.microzona || "")) || null;
    r.elementi = (s.elementi || []).filter(Boolean).length;
    const [s1, s2] = R.sub_elementi;
    r.sub = r.elementi <= s1 ? 1 : r.elementi <= s2 ? 2 : 3;
    const epoca = R.epoca[s.epoca];
    if (r.microzona) {
      r.fascia_base = [r.microzona[2], r.microzona[3]];
      if (epoca) {
        r.epoca_perc = epoca[r.sub - 1];
        r.fascia = r.fascia_base.map((x) => Math.round(x * (100 + r.epoca_perc) * 10) / 1000);
      }
    }
    if (!r.microzona) avvisi.push("Scegli la microzona.");
    else if (!epoca) avvisi.push("Indica l'epoca di costruzione o di ristrutturazione totale dell'alloggio: cambia i valori della sub-fascia.");

    const sup = superficie(accordo, s);
    r.superficie = sup;
    if (sup) avvisi.push(...sup.note);

    // aumenti non cumulabili: vale il maggiore (art. 8)
    if (tipo === "agevolato") {
      const p = R.durata[String(Math.min(6, Number(s.durata_anni) || 3))] || 0;
      if (p) r.aumenti.push({ nome: `durata ${Math.min(6, Number(s.durata_anni))} + 2 anni`, percento: p });
    }
    if (s.arredato) r.aumenti.push({ nome: "alloggio totalmente ammobiliato", percento: Math.min(R.arredato, Math.abs(numero(s.arredato_perc) ?? R.arredato)) });
    if (s.storico) r.aumenti.push({ nome: "immobile storico totalmente ristrutturato", percento: Math.min(R.storico_ristrutturato, Math.abs(numero(s.storico_perc) ?? R.storico_ristrutturato)) });
    r.aumento = r.aumenti.length ? r.aumenti.reduce((a, b) => (b.percento > a.percento ? b : a)) : null;
    if (r.aumenti.length > 1) avvisi.push(`Gli aumenti non si sommano: vale il maggiore (${r.aumento.nome}, +${r.aumento.percento}%).`);
    const perc = r.aumento ? r.aumento.percento : 0;

    if (r.fascia) {
      r.valore_proposto = r.fascia[1];
      const scritto = numero(s.valore_mq);
      r.valore = scritto !== null ? scritto : r.valore_proposto;
      if (scritto !== null && scritto > r.fascia[1] + 0.0005) avvisi.push(`Il valore al mq supera il massimo della sub-fascia (€ ${virgola(r.fascia[1], 3)}).`);
      if (scritto !== null && scritto < r.fascia[0] - 0.0005) avvisi.push(`Il valore al mq è sotto il minimo della sub-fascia (€ ${virgola(r.fascia[0], 3)}).`);
      if (sup) {
        r.canone_base = cent(sup.totale * r.valore);
        r.canone = cent(r.canone_base * (1 + perc / 100));
        r.canone_massimo = cent(sup.totale * r.fascia[1] * (1 + perc / 100));
      }
    }
    if (!sup) avvisi.push("Inserisci la superficie calpestabile dell'appartamento.");
    const pattuito = numero(s.canone_mensile);
    if (pattuito !== null) {
      r.canone_pattuito = pattuito;
      if (r.canone_massimo !== null && pattuito > r.canone_massimo + 0.005) avvisi.push(`Il canone pattuito supera il massimo (€ ${virgola(r.canone_massimo)} al mese).`);
    }
    return r;
  }

  return { calcola, superficie, numero, virgola };
});

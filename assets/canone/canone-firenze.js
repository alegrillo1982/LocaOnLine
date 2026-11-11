/*
 * Il calcolo del canone concordato secondo l'Accordo territoriale sulle
 * locazioni abitative di Firenze e comuni limitrofi, firmato il 3 luglio 2025
 * (Comune di Firenze). Dati in accordi/firenze-2025-07-03.json. Gira nel
 * browser e con Node.
 *
 *   CanoneFirenze.calcola(accordo, scheda) -> risultato
 *
 * Come funziona l'accordo:
 * - sei zone omogenee (art. 4, per microzone) e tre tipologie A, B, C
 *   (art. 8): valori MENSILI al mq, minimo 2 € e massimo per zona (art. 5);
 * - tipologia B: almeno 6 delle 7 caratteristiche a-g; C: ne mancano almeno
 *   due tra a, b, c, d, f; A: costruito o ristrutturato negli ultimi 10 anni
 *   con i requisiti dell'art. 8 a), oppure requisiti B e almeno 6 dei 12
 *   elementi dell'art. 8;
 * - superficie convenzionale (art. 6): interna utile; 30% delle parti alte
 *   tra 180 e 240 cm; autorimessa 50%; lastrico all'attico 25% fino ai mq
 *   dell'alloggio e 5% oltre; posti auto 30/25/20/5%; balconi, terrazze,
 *   cantine 25%; area scoperta 10% fino ai mq dell'alloggio e 2% oltre;
 *   alloggio sotto 60 mq +20% fino a 63, da 60 a 65 mq +5% fino a 65;
 * - maggiorazioni progressive, una sull'altra (art. 10): arredo fino a 15%
 *   (3/4 dei vani 10%, metà 7%), pregio 15% (A/7 10%), classe energetica da
 *   E +2% ad A4 +15%, transitorio per studio +5%, studenti fino a 15%, e per
 *   ultima la durata 4/5/6 + 2 anni +4,5/6/7,5%;
 * - porzione (art. 15): il canone dell'intero diviso per i mq a uso
 *   esclusivo, per i mq della porzione.
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.CanoneFirenze = fabbrica();
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

  /** La tipologia dell'alloggio (art. 8). */
  function tipologia(accordo, s) {
    const R = accordo.regole, b = s.caratteristiche || [], a = s.elementi || [];
    const nb = b.filter(Boolean).length, mancanoC = R.decisive_c.filter((i) => !b[i]).length;
    const requisitiB = nb >= 6, na = a.filter(Boolean).length;
    if (requisitiB && (s.recente || na >= 6)) return { tipo: "A", perche: s.recente ? "costruito o ristrutturato negli ultimi 10 anni con i requisiti dell'art. 8 a)" : `requisiti B e ${na} elementi su 12` };
    if (mancanoC >= 2) return { tipo: "C", perche: `mancano ${mancanoC} caratteristiche tra a, b, c, d, f` };
    return { tipo: "B", perche: requisitiB ? `${nb} caratteristiche su 7` : `${nb} caratteristiche su 7: non è C (mancano meno di due tra a, b, c, d, f)` };
  }

  /** La superficie convenzionale (art. 6). */
  function superficie(accordo, s) {
    const R = accordo.regole.superficie, sup = s.superfici || {};
    const A = numero(sup.utile);
    if (A === null) return null;
    const n = (k) => numero(sup[k]) || 0, note = [];
    const fino = (x, [p1, p2]) => Math.min(x, A) * p1 + Math.max(0, x - A) * p2;
    const voci = [
      ["utile", A, A], ["basse", n("basse"), n("basse") * R.basse], ["autorimessa", n("autorimessa"), n("autorimessa") * R.autorimessa],
      ["attico", n("attico"), fino(n("attico"), R.attico)], ["posto_esclusivo", n("posto_esclusivo"), n("posto_esclusivo") * R.posto_esclusivo],
      ["posto_coperto", n("posto_coperto"), n("posto_coperto") * R.posto_coperto], ["posto_scoperto", n("posto_scoperto"), n("posto_scoperto") * R.posto_scoperto],
      ["posto_rotazione", n("posto_rotazione"), n("posto_rotazione") * R.posto_rotazione], ["balconi", n("balconi"), n("balconi") * R.balconi],
      ["scoperta", n("scoperta"), fino(n("scoperta"), R.scoperta)]];
    const righe = voci.map(([chiave, mq, c]) => ({ chiave, mq, convenzionale: cent(c) }));
    const lorda = cent(righe.reduce((t, r) => t + r.convenzionale, 0));
    let totale = lorda;
    const [[s1, p1, m1], [s2, p2, m2]] = R.piccoli;
    if (A < s1) totale = Math.max(lorda, Math.min(lorda * (1 + p1), m1));
    else if (A > s1 && A <= s2) totale = Math.max(lorda, Math.min(lorda * (1 + p2), m2));
    if (totale > lorda) note.push(`Alloggio di ${virgola(A)} mq calpestabili: superficie aumentata del ${A < s1 ? 20 : 5}% fino a ${A < s1 ? m1 : m2} mq.`);
    return { righe, lorda, totale: cent(totale), note };
  }

  function calcola(accordo, s) {
    const R = accordo.regole, avvisi = [];
    const tipo = s.tipo || "agevolato";
    const r = { avvisi, zona: null, tipologia: null, fascia: null, superficie: null, maggiorazioni: [], fattore: 1,
      fascia_magg: null, valore: null, valore_proposto: null, canone_intero: null, canone_minimo: null, canone: null,
      canone_massimo: null, canone_pattuito: null, porzione: null };
    r.zona = R.zone.find((z) => z[0] === s.zona) || null;
    r.tipologia = tipologia(accordo, s);
    if (!r.zona) avvisi.push("Scegli la zona.");
    else r.fascia = r.zona[4][r.tipologia.tipo];

    // maggiorazioni progressive (art. 10): la durata per ultima (art. 3)
    const add = (nome, percento) => { if (percento) r.maggiorazioni.push({ nome, percento }); };
    const arr = { tutto: "arredato in ogni vano", tre_quarti: "arredati 3/4 dei vani", meta: "arredata metà dei vani" };
    if (s.arredo) add(arr[s.arredo], Math.min(R.arredo[s.arredo] || 0, numero(s.arredo_perc) ?? R.arredo[s.arredo] ?? 0));
    if (s.energia) add(`classe energetica ${s.energia}`, R.energia[s.energia] || 0);
    if (s.pregio) add(s.pregio === "a7" ? "categoria A/7" : "immobile di particolare pregio (art. 1 c. 2 a L. 431/98)", R.pregio[s.pregio] || 0);
    if (tipo === "transitorio" && s.studio) add("transitorio per studio o formazione", R.transitorio_studio);
    if (tipo === "studenti") add("contratto per studenti", Math.min(R.studenti, numero(s.studenti_perc) ?? R.studenti));
    if (tipo === "agevolato") { const anni = String(Math.min(6, Number(s.durata_anni) || 3)); add(`durata ${s.durata_anni} + 2 anni`, R.durata[anni] || 0); }
    r.fattore = r.maggiorazioni.reduce((f, m) => f * (1 + m.percento / 100), 1);
    if (r.fascia) r.fascia_magg = r.fascia.map((x) => Math.round(x * r.fattore * 1000) / 1000);

    const sup = superficie(accordo, s);
    r.superficie = sup;
    if (sup) avvisi.push(...sup.note); else avvisi.push("Inserisci la superficie interna utile.");

    if (r.fascia_magg) {
      r.valore_proposto = r.fascia_magg[1];
      const scritto = numero(s.valore_mq);
      r.valore = scritto !== null ? scritto : r.valore_proposto;
      if (scritto !== null && scritto > r.fascia_magg[1] + 0.0005) avvisi.push(`Il valore al mq supera il massimo (€ ${virgola(r.fascia_magg[1], 3)} al mese).`);
      if (scritto !== null && scritto < r.fascia_magg[0] - 0.0005) avvisi.push(`Il valore al mq è sotto il minimo (€ ${virgola(r.fascia_magg[0], 3)} al mese).`);
      if (sup) {
        let k = 1;
        if (s.porzione) {
          const p = numero(s.mq_porzione), t = numero(s.mq_esclusivi);
          if (p !== null && t) { k = p / t; r.porzione = { mq: p, totale: t, quota: k }; avvisi.push(`Porzione: ${virgola(p)} mq su ${virgola(t)} mq a uso esclusivo (art. 15).`); }
          else avvisi.push("Porzione: indica i mq della parte locata e i mq a uso esclusivo di tutte le stanze.");
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
      if (r.canone_massimo !== null && pattuito <= r.canone_massimo * 0.9 + 0.005) avvisi.push("Canone almeno del 10% sotto il massimo: a Firenze dà diritto all'IMU agevolata, con la certificazione nell'attestazione (art. 14).");
    }
    return r;
  }

  return { calcola, superficie, tipologia, numero, virgola };
});

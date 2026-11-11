/*
 * Il calcolo del canone concordato secondo l'Accordo territoriale per il
 * Comune di Genova firmato il 29 maggio 2025 e depositato il 3 giugno 2025
 * (in vigore dal 16 giugno 2025). Dati in accordi/genova-2025-06-03.json.
 * Gira nel browser e con Node.
 *
 *   CanoneGenova.calcola(accordo, scheda) -> risultato
 *
 * Come funziona l'accordo:
 * - 85 zone OMI (allegato 1), valori ANNUI al mq utile (allegato 2);
 * - tre sottofasce dai 21 elementi della scheda tecnica (allegato 4): 1-2
 *   elementi la 1^, 3-8 la 2^, 9 e oltre la 3^; senza gli elementi 2
 *   (riscaldamento) e 4 (bagno con doccia o vasca) si resta nella 1^.
 *   Come si divide la fascia l'accordo 2025 non lo dice: si usa la regola
 *   dell'accordo precedente, 25% / 50% / 25% (regole.sottofasce.quote);
 * - superficie (art. A1): da visura catastale; senza visura, quella
 *   dell'APE + 20% + aree esterne e pertinenze (allegato 3). Sotto i 45 mq
 *   +30% (fino a 54), 45-60 mq +20% (fino a 67), 61-69 mq +10% (fino a 70),
 *   oltre 100 mq l'eccedenza conta il 70%; niente correzioni per le porzioni;
 * - maggiorazioni (si sommano): arredato +12% (parzialmente +6%); durata
 *   4, 5, 6 + 2 anni +2/4/6%; immobile vincolato +30%, solo il fabbricato
 *   +15%; transitorio ordinario +10%, con l'arredo al massimo +16% in
 *   tutto; studenti arredato +12%;
 * - il canone non supera il massimo della sottofascia; può scendere sotto
 *   il suo minimo ma non sotto il minimo della zona.
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.CanoneGenova = fabbrica();
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
  /** "c5", "C 05", "c05a" -> "C05", "C05A" */
  const codiceZona = (x) => {
    const m = String(x || "").toUpperCase().replace(/\s/g, "").match(/^([A-Z])0*(\d+)([A-Z]?)$/);
    if (!m) return String(x || "").toUpperCase().trim();
    return m[1] + (m[1] === "E" || m[1] === "R" ? m[2] : m[2].padStart(2, "0")) + m[3];
  };

  /** La superficie per il calcolo (art. A1). */
  function superficie(accordo, s) {
    const R = accordo.regole.superficie, note = [];
    if (s.porzione) {
      const p = numero(s.mq_porzione), c = numero(s.mq_comuni) || 0;
      if (p === null) return null;
      note.push("Porzione di immobile: niente correzioni per la metratura; il canone segue la superficie locata (art. A8).");
      return { porzione: true, intera: null, base: cent(p + c), calcolo: cent(p + c), note };
    }
    const mq = numero(s.mq);
    if (mq === null) return null;
    let base = mq;
    if (s.fonte_sup === "ape") {
      const pert = numero(s.pertinenze) || 0;
      base = mq * (1 + R.ape) + pert;
      note.push(`Dall'APE: ${virgola(mq)} mq + 20%${pert ? ` + ${virgola(pert)} mq di aree esterne e pertinenze` : ""} = ${virgola(base)} mq.`);
    }
    base = cent(base);
    let calcolo = base;
    const piccolo = R.piccoli.find(([fino]) => base < fino || (fino === 60 && base <= 60));
    if (piccolo) {
      const [, perc, tetto] = piccolo;
      calcolo = Math.max(base, Math.min(base * (1 + perc), tetto));
      if (calcolo > base) note.push(`Alloggio piccolo: +${Math.round(perc * 100)}% fino a ${tetto} mq.`);
    } else if (base > R.grandi[0]) {
      calcolo = R.grandi[0] + (base - R.grandi[0]) * (1 - R.grandi[1]);
      note.push(`Oltre i 100 mq: la parte eccedente conta il ${100 - Math.round(R.grandi[1] * 100)}%.`);
    }
    return { porzione: false, intera: base, base, calcolo: cent(calcolo), note };
  }

  function calcola(accordo, s) {
    const R = accordo.regole, avvisi = [];
    const tipo = s.tipo || "agevolato";
    const r = { avvisi, zona: null, elementi: 0, sub: 1, fascia_zona: null, fascia: null, superficie: null,
      maggiorazioni: [], percento: 0, fascia_magg: null, valore: null, valore_proposto: null,
      annuo_minimo_zona: null, annuo_minimo: null, annuo_massimo: null, canone_annuo: null, canone: null,
      canone_massimo: null, canone_pattuito: null };

    const codice = codiceZona(s.zona);
    r.zona = R.zone.find((z) => z[0] === codice) || null;
    if (!r.zona) avvisi.push("Scegli la zona.");

    // sottofascia dagli elementi
    const el = s.elementi || [];
    r.elementi = el.filter(Boolean).length;
    const [fino1, fino2] = R.sottofasce.elementi;
    r.sub = r.elementi <= fino1 ? 1 : r.elementi <= fino2 ? 2 : 3;
    const mancano = R.sottofasce.obbligatori.filter((n) => !el[n - 1]);
    if (r.sub > 1 && mancano.length) {
      avvisi.push(`Senza ${mancano.length > 1 ? "gli elementi" : "l'elemento"} ${mancano.join(" e ")} (obbligatori) si resta nella 1^ sottofascia.`);
      r.sub = 1;
    }
    if (r.zona) {
      const [, min, max] = r.zona, d = max - min, [q1, q2] = R.sottofasce.quote;
      r.fascia_zona = [min, max];
      const tagli = [min, cent(min + d * q1), cent(min + d * q2), max];
      r.fascia = [tagli[r.sub - 1], tagli[r.sub]];
    }

    // maggiorazioni: si sommano
    const add = (nome, percento, riga) => { if (percento) r.maggiorazioni.push({ nome, percento, riga }); };
    const arredo = R.arredo[s.arredo] || 0;
    if (tipo === "agevolato") {
      add(s.arredo === "parziale" ? "arredato parzialmente" : "arredato", arredo, "arredo");
      const anni = Number(s.durata_anni) || 3;
      add(`durata ${anni} + 2 anni`, R.durata[String(anni)] || 0, "durata");
    } else if (tipo === "transitorio") {
      const p = Math.min(R.transitorio + arredo, R.transitorio_con_arredo_max);
      add(arredo ? "transitorio ordinario, arredato" : "transitorio ordinario", p, "transitorio");
      if (arredo) avvisi.push(`Transitorio arredato: l'aumento complessivo non supera il ${R.transitorio_con_arredo_max}%.`);
    } else if (tipo === "studenti") {
      add(s.arredo === "parziale" ? "studenti, arredato parzialmente" : "studenti, arredato", arredo, "studenti");
    }
    add(s.vincolo === "fabbricato" ? "fabbricato vincolato" : "immobile vincolato", R.vincolo[s.vincolo] || 0, "vincolo");
    r.percento = r.maggiorazioni.reduce((t, m) => t + m.percento, 0);
    const k = 1 + r.percento / 100;
    if (r.fascia) r.fascia_magg = r.fascia.map((x) => Math.round(x * k * 1000) / 1000);

    const sup = superficie(accordo, s);
    r.superficie = sup;
    if (sup) avvisi.push(...sup.note);
    else avvisi.push(s.porzione ? "Inserisci i mq della porzione locata." : "Inserisci la superficie.");

    if (r.fascia_magg) {
      r.valore_proposto = r.fascia_magg[1];
      const scritto = numero(s.valore_mq);
      r.valore = scritto !== null ? scritto : r.valore_proposto;
      if (scritto !== null && scritto > r.fascia_magg[1] + 0.0005) avvisi.push(`Il valore al mq supera il massimo della sottofascia (€ ${virgola(r.fascia_magg[1], 3)} l'anno).`);
      if (scritto !== null && scritto < r.fascia_zona[0] - 0.0005) avvisi.push(`Il valore al mq è sotto il minimo della zona (€ ${virgola(r.fascia_zona[0])} l'anno): non è consentito.`);
      if (sup) {
        const mq = sup.calcolo;
        r.annuo_minimo_zona = cent(mq * r.fascia_zona[0]);
        r.annuo_minimo = cent(mq * r.fascia_magg[0]);
        r.annuo_massimo = cent(mq * r.fascia_magg[1]);
        r.canone_annuo = cent(mq * r.valore);
        r.canone = cent(r.canone_annuo / 12);
        r.canone_massimo = cent(r.annuo_massimo / 12);
      }
    }
    const pattuito = numero(s.canone_mensile);
    if (pattuito !== null) {
      r.canone_pattuito = pattuito;
      if (r.canone_massimo !== null && pattuito > r.canone_massimo + 0.005) avvisi.push(`Il canone pattuito supera il massimo (€ ${virgola(r.canone_massimo)} al mese).`);
      if (r.annuo_minimo_zona !== null && pattuito < r.annuo_minimo_zona / 12 - 0.005) avvisi.push(`Il canone pattuito è sotto il minimo della zona (€ ${virgola(r.annuo_minimo_zona / 12)} al mese).`);
    }
    return r;
  }

  return { calcola, superficie, numero, virgola, codiceZona };
});

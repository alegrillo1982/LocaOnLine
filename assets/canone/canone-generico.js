/*
 * Il calcolo del canone concordato per gli accordi descritti solo con i dati
 * ("regole.generico": true), senza un modulo scritto apposta: zone con fasce
 * di valori, elementi da contare (o punti da sommare) per scegliere la
 * fascia, superficie convenzionale con coefficienti, maggiorazioni e
 * riduzioni in percentuale. Gira nel browser e con Node.
 *
 *   CanoneGenerico.calcola(accordo, scheda) -> risultato
 *
 * Le regole (accordi/<codice>.json, "regole"):
 *   unita: "anno" | "mese"                     valori al mq annui o mensili
 *   zone: [{codice, nome, nota, fasce}]        fasce dalla più bassa: [[min, max], ...],
 *                                              oppure {"3": [...], "4": [...]} per durata
 *   fasce: {nomi, criterio: "conta"|"punti", soglie: [s0, s1], soglie_zona: {codice: [..]},
 *           obbligatori: [indici], pregio_soglia}
 *   elementi: [{testo, punti}]
 *   superficie: {base: testo, correzioni: [{fino, incluso, perc, tetto}], grandi: {oltre, perc},
 *                voci: [{chiave, testo, coeff, coeff_zona, tetto: "base"}]}
 *   correttivi_superficie: [{da, a, perc, zone, escluse, nome}]   % secondo la superficie convenzionale
 *   maggiorazioni: [{chiave, testo, tipo: "spunta"|"scelta", perc, opzioni: [{valore, testo, perc}],
 *                    contratti: [...], zone, escluse, ammobiliato: true}]
 *   durata: {"4": p, "5": p, "6": p}           (solo agevolati; assente se i valori sono per durata)
 *   contratto: {transitorio: p, studenti: p}
 *   combinazione: "somma" | "prodotto"
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.CanoneGenerico = fabbrica();
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
  const perZona = (o, z) => !o || ((!o.zone || o.zone.includes(z)) && !(o.escluse || []).includes(z));

  function superficie(accordo, s) {
    const R = accordo.regole.superficie || {}, sup = s.superfici || {}, z = String(s.zona || "");
    const U = numero(sup.base);
    if (U === null) return null;
    const note = [];
    let base = U;
    const c = (R.correzioni || []).find((x) => (x.incluso ? U <= x.fino : U < x.fino));
    if (c) {
      base = Math.max(U, Math.min(U * (1 + c.perc / 100), c.tetto ?? Infinity));
      if (base > U) note.push(`Superficie ${c.perc > 0 ? "aumentata" : "ridotta"} del ${Math.abs(c.perc)}%${c.tetto ? ` (al massimo ${virgola(c.tetto)} mq)` : ""}.`);
    } else if (R.grandi && U > R.grandi.oltre) {
      base = R.grandi.oltre + (U - R.grandi.oltre) * R.grandi.perc / 100;
      note.push(`Oltre ${R.grandi.oltre} mq la parte eccedente conta il ${R.grandi.perc}%.`);
    }
    const righe = [{ chiave: "base", mq: U, coeff: 1, convenzionale: cent(base) }];
    for (const v of R.voci || []) {
      const mq = numero(sup[v.chiave]) || 0;
      const k = v.coeff_zona && v.coeff_zona[z] !== undefined ? v.coeff_zona[z] : v.coeff;
      let conv = mq * k;
      if (v.tetto === "base" && conv > U) { conv = U; note.push(`${v.testo}: al massimo la superficie dell'alloggio.`); }
      righe.push({ chiave: v.chiave, mq, coeff: k, convenzionale: cent(conv) });
    }
    return { righe, base: cent(base), totale: cent(righe.reduce((t, r) => t + r.convenzionale, 0)), note };
  }

  function fascia(accordo, s, zona) {
    const F = accordo.regole.fasce, el = s.elementi || [], E = accordo.regole.elementi;
    const n = F.criterio === "punti" ? E.reduce((t, e, i) => t + (el[i] ? e.punti || 0 : 0), 0) : el.filter(Boolean).length;
    const soglie = (F.soglie_zona && zona && F.soglie_zona[zona.codice]) || F.soglie;
    let i = soglie.findIndex((x) => n <= x);
    if (i < 0) i = soglie.length;
    const mancano = (F.obbligatori || []).filter((k) => !el[k]);
    const avviso = i > 0 && mancano.length ? `Senza ${mancano.map((k) => `l'elemento ${k + 1}`).join(" e ")} si resta nella fascia più bassa.` : "";
    if (avviso) i = 0;
    return { n, i, nome: F.nomi[i], avviso };
  }

  function calcola(accordo, s) {
    const R = accordo.regole, avvisi = [];
    const tipo = s.tipo || "agevolato", anni = Math.min(6, Number(s.durata_anni) || 3);
    const r = { avvisi, zona: null, fascia: null, base: null, maggiorazioni: [], fattore: 1, valori: null, superficie: null,
      valore: null, valore_proposto: null, canone_intero: null, canone_minimo: null, canone: null, canone_massimo: null,
      canone_pattuito: null, quota: null, punti: 0 };
    r.zona = R.zone.find((z) => z.codice === String(s.zona || "")) || null;
    if (!r.zona) avvisi.push("Scegli la zona.");
    const f = fascia(accordo, s, r.zona);
    r.fascia = f; r.punti = f.n;
    if (f.avviso) avvisi.push(f.avviso);
    if (r.zona) {
      const tab = Array.isArray(r.zona.fasce) ? r.zona.fasce : r.zona.fasce[tipo === "agevolato" ? String(anni) : "3"] || r.zona.fasce["3"];
      r.base = tab[f.i];
    }
    const z = r.zona ? r.zona.codice : "";
    const add = (nome, perc) => { if (perc) r.maggiorazioni.push({ nome, perc }); };
    const sup = superficie(accordo, s);
    r.superficie = sup;
    if (sup) avvisi.push(...sup.note); else avvisi.push("Inserisci la superficie.");
    for (const m of R.maggiorazioni || []) {
      if (m.contratti && !m.contratti.includes(tipo)) continue;
      if (!perZona(m, z)) continue;
      const val = (s.maggiorazioni_scelte || {})[m.chiave];
      if (m.tipo === "scelta") { const o = (m.opzioni || []).find((x) => x.valore === val); if (o && o.perc) add(`${m.nome || m.testo}: ${o.testo}`, o.perc); }
      else if (val) add(m.nome || m.testo, m.perc);
    }
    if (sup) for (const c of R.correttivi_superficie || []) {
      if (!perZona(c, z)) continue;
      if ((c.da === undefined || sup.totale >= c.da) && (c.a === undefined || sup.totale <= c.a)) add(c.nome, c.perc);
    }
    if (tipo === "agevolato" && R.durata) add(`durata ${s.durata_anni} + 2 anni`, R.durata[String(anni)] || 0);
    if (R.contratto && R.contratto[tipo]) add(tipo === "studenti" ? "contratto per studenti" : "contratto transitorio", R.contratto[tipo]);
    r.fattore = R.combinazione === "prodotto"
      ? r.maggiorazioni.reduce((k, m) => k * (1 + m.perc / 100), 1)
      : 1 + r.maggiorazioni.reduce((t, m) => t + m.perc, 0) / 100;
    if (r.base) r.valori = r.base.map((x) => Math.round(x * r.fattore * 1000) / 1000);
    if (r.valori) {
      r.valore_proposto = r.valori[1];
      const scritto = numero(s.valore_mq);
      r.valore = scritto !== null ? scritto : r.valore_proposto;
      const u = R.unita === "anno" ? "l'anno" : "al mese";
      if (scritto !== null && scritto > r.valori[1] + 0.0005) avvisi.push(`Il valore al mq supera il massimo (€ ${virgola(r.valori[1])} ${u}).`);
      if (scritto !== null && scritto < r.valori[0] - 0.0005) avvisi.push(`Il valore al mq è sotto il minimo (€ ${virgola(r.valori[0])} ${u}).`);
      if (sup) {
        let k = 1;
        if (s.porzione) {
          const p = numero(s.mq_porzione);
          if (p !== null && sup.righe[0].mq) { k = Math.min(1, p / sup.righe[0].mq); r.quota = k; avvisi.push(`Porzione: ${virgola(p)} mq su ${virgola(sup.righe[0].mq)} (${virgola(k * 100)}%).`); }
          else avvisi.push("Porzione: indica i mq della parte locata, compresa la quota delle parti condivise.");
        }
        const mese = R.unita === "anno" ? 12 : 1;
        r.canone_intero = cent(sup.totale * r.valore / mese);
        r.canone = cent(r.canone_intero * k);
        r.canone_minimo = cent(sup.totale * r.valori[0] / mese * k);
        r.canone_massimo = cent(sup.totale * r.valori[1] / mese * k);
      }
    }
    const pattuito = numero(s.canone_mensile);
    if (pattuito !== null) {
      r.canone_pattuito = pattuito;
      if (r.canone_massimo !== null && pattuito > r.canone_massimo + 0.005) avvisi.push(`Il canone pattuito supera il massimo (€ ${virgola(r.canone_massimo)} al mese).`);
      if (r.canone_minimo !== null && pattuito < r.canone_minimo - 0.005) avvisi.push(`Il canone pattuito è sotto il minimo (€ ${virgola(r.canone_minimo)} al mese).`);
    }
    for (const a of (R.avvisi || [])) if (perZona(a, z) && (!a.fascia || a.fascia.includes(f.n))) avvisi.push(a.testo);
    return r;
  }

  return { calcola, superficie, fascia, numero, virgola };
});

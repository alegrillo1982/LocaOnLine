/*
 * Il calcolo del canone concordato secondo l'Accordo territoriale per il
 * Comune di Venezia, integrato e modificato il 28 luglio 2026 (in vigore dal
 * 1° settembre 2026). Dati in accordi/venezia-2026-07-28.json. Gira nel
 * browser e con Node.
 *
 *   CanoneVenezia.calcola(accordo, scheda) -> risultato
 *
 * Come funziona l'accordo:
 * - 5 zone omogenee, tre subfasce per zona, valori ANNUI al mq (Tabella 1,
 *   aggiornata a gennaio 2026);
 * - subfascia (Tab. 3) dagli elementi A, B, C, D della Tab. 2: superiore con
 *   tutti gli A, almeno 3 B (Venezia e isole) o 4 B e 2 C (terraferma e
 *   Lido), e a Venezia 2 D o un C e un D; intermedia con almeno 4 A (tra cui
 *   elettrico, acqua, gas) e 4 tra B, C (e D a Venezia); altrimenti
 *   inferiore, e comunque inferiore per A/5 o rischio acqua alta;
 * - zone di pregio: massimo +30% (zona 1) o +20% (zone 3, 4, 5); zona 1 con
 *   altezza sotto 2,50 m o piano terra a rischio acqua alta: massimo -20%;
 *   area di degrado di Marghera: minimo e massimo -15%;
 * - Tab. 3: almeno tre interventi di manutenzione negli ultimi 10 anni,
 *   massimo +10%; oltre 30 anni senza lavori (fuori dal centro storico)
 *   massimo -10%; senza bagno interno o senza fognatura: dal minimo al
 *   minimo +10%;
 * - poi: vincolato +15%, classe energetica (A fino a +15%, B +5%, F -5%,
 *   G -10%), durata 4, 5, 6 anni +2/4/6%, transitorio massimo +10%,
 *   studenti massimo +15%; arredo massimo +15% (completo con
 *   elettrodomestici +25%), ma non sulle superfici accessorie;
 * - superficie (E): utile x coefficiente K (1,3 sotto 38 mq ... 0,9 oltre
 *   160) + accessori (autorimessa 85%/60%, posti auto, balconi e cantine
 *   25%, scoperto 15%, verde condominiale 10%, entro il 50% o 30%
 *   dell'alloggio; vani tra 1 e 1,70 m al 50%); porzione in proporzione.
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.CanoneVenezia = fabbrica();
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

  /** Il coefficiente K della lettera E a). */
  function coefficienteK(u) {
    if (u < 38) return 1.3;
    if (u < 45) return 1.5714 - 0.714 / 100 * u;
    if (u < 70) return 1.52 - 0.6 / 100 * u;
    if (u < 110) return 1.275 - 0.25 / 100 * u;
    if (u < 160) return 1.22 - 0.2 / 100 * u;
    return 0.9;
  }

  function superficie(accordo, s) {
    const R = accordo.regole.superficie, sup = s.superfici || {}, z = String(s.zona || "");
    const U = numero(sup.utile);
    if (U === null) return null;
    const n = (k) => numero(sup[k]) || 0, perZona = (o) => (z === "5" ? o["5"] : o.altre), note = [];
    const K = Math.round(coefficienteK(U) * 10000) / 10000;
    const supK = cent(U * K);
    const scoperte = n("scoperta") * R.scoperta + n("verde") * R.verde;
    const tetto = U * (R.tetto_scoperte[z] || R.tetto_scoperte.altre);
    if (scoperte > tetto) note.push(`Aree scoperte (esclusive e verde condominiale) contate al massimo per ${virgola(tetto)} mq.`);
    const righe = [
      { chiave: "utile", mq: U, convenzionale: supK },
      { chiave: "basse", mq: n("basse"), convenzionale: cent(n("basse") * R.basse) },
      { chiave: "autorimessa", mq: n("autorimessa"), convenzionale: cent(n("autorimessa") * perZona(R.autorimessa)) },
      { chiave: "posto_coperto", mq: n("posto_coperto"), convenzionale: cent(n("posto_coperto") * perZona(R.posto_coperto)) },
      { chiave: "posto_scoperto", mq: n("posto_scoperto"), convenzionale: cent(n("posto_scoperto") * perZona(R.posto_scoperto)) },
      { chiave: "accessori", mq: n("accessori"), convenzionale: cent(n("accessori") * R.accessori) },
      { chiave: "scoperta", mq: n("scoperta"), convenzionale: cent(Math.min(n("scoperta") * R.scoperta, tetto)) },
      { chiave: "verde", mq: n("verde"), convenzionale: cent(Math.max(0, Math.min(n("verde") * R.verde, tetto - Math.min(n("scoperta") * R.scoperta, tetto)))) }];
    const supA = cent(righe.slice(1).reduce((t, r) => t + r.convenzionale, 0));
    return { righe, K, supK, supA, totale: cent(supK + supA), note };
  }

  /** La subfascia (Tab. 3): 0 inferiore, 1 intermedia, 2 superiore. */
  function subfascia(accordo, s) {
    const e = s.elementi || {}, conta = (k) => (e[k] || []).filter(Boolean).length;
    const nA = conta("A"), nB = conta("B"), nC = conta("C"), nD = conta("D");
    const venezia = s.localita === "venezia";
    const A = e.A || [];
    if (s.a5) return { n: 0, perche: "categoria catastale A/5" };
    if (s.acqua_alta) return { n: 0, perche: "rischio di acqua alta senza opere di difesa" };
    const sup = nA === 6 && (venezia ? nB >= 3 && (nD >= 2 || (nC >= 1 && nD >= 1)) : nB >= 4 && nC >= 2);
    if (sup) return { n: 2, perche: "tutti gli A e gli elementi B, C, D richiesti" };
    const inter = nA >= 4 && A[0] && A[1] && A[2] && (venezia ? nB + nC + nD >= 4 : nB + nC >= 4);
    if (inter) return { n: 1, perche: `${nA} elementi A con elettrico, acqua e gas; ${venezia ? nB + nC + nD : nB + nC} tra B, C${venezia ? ", D" : ""}` };
    return { n: 0, perche: "requisiti della subfascia intermedia non raggiunti" };
  }

  function calcola(accordo, s) {
    const R = accordo.regole, avvisi = [];
    const tipo = s.tipo || "agevolato", z = String(s.zona || "");
    const r = { avvisi, zona: null, sub: null, base: null, correzioni: [], fascia: null, arredo: 0, superficie: null,
      valore: null, valore_proposto: null, canone_minimo: null, canone: null, canone_massimo: null, canone_pattuito: null, quota: null };
    r.zona = R.zone.find((x) => x[0] === z) || null;
    if (!r.zona) { avvisi.push("Scegli la zona."); }
    if ((z === "4" || z === "5") && s.localita !== "terraferma") s.localita = "terraferma";
    r.sub = subfascia(accordo, s);
    if (r.zona) {
      r.base = R.tab1[z][r.sub.n].slice();
      let [mn, mx] = r.base;
      const corr = (nome, kmin, kmax) => { mn *= kmin; mx *= kmax; r.correzioni.push({ nome, kmin, kmax }); };
      if (s.pregio && R.pregio_perc[z]) corr("zona di particolare pregio", 1, 1 + R.pregio_perc[z] / 100);
      if (z === "1" && s.zona1_penalita) corr("zona 1: altezza sotto 2,50 m o piano terra a rischio acqua alta", 1, 1 - R.zona1_penalita / 100);
      if (z === "5" && s.degrado) corr("area di particolare degrado (Marghera)", 1 - R.degrado / 100, 1 - R.degrado / 100);
      if (s.manutenzione) corr("almeno 3 interventi di manutenzione negli ultimi 10 anni", 1, 1 + R.manutenzione / 100);
      if (s.vetusto) {
        if (s.localita === "venezia" && ["1", "2", "3"].includes(z)) avvisi.push("La riduzione per gli immobili oltre i 30 anni non si applica nel centro storico (zone 1, 2, 3 di Venezia).");
        else corr("oltre 30 anni senza lavori documentati", 1, 1 - R.vetusta / 100);
      }
      if (s.vincolato) corr("immobile vincolato", 1 + R.vincolato / 100, 1 + R.vincolato / 100);
      const en = R.energia[s.energia];
      if (en) corr(`classe energetica ${s.energia}`, en < 0 ? 1 + en / 100 : 1, 1 + en / 100);
      if (tipo === "agevolato") { const p = R.durata[String(Math.min(6, Number(s.durata_anni) || 3))]; if (p) corr(`durata ${s.durata_anni} + 2 anni`, 1 + p / 100, 1 + p / 100); }
      if (tipo === "transitorio") corr("contratto transitorio", 1, 1 + R.transitorio / 100);
      if (tipo === "studenti") corr("contratto per studenti", 1, 1 + R.studenti / 100);
      if (s.senza_bagno) { mx = Math.min(mx, mn * (1 + R.senza_bagno / 100)); avvisi.push("Senza bagno interno o senza fognatura: dal minimo al minimo +10%."); }
      r.fascia = [Math.round(mn * 1000) / 1000, Math.round(mx * 1000) / 1000];
    }
    if (s.arredo) r.arredo = R.arredo[s.arredo] || 0;
    const sup = superficie(accordo, s);
    r.superficie = sup;
    if (sup) avvisi.push(...sup.note); else avvisi.push("Inserisci la superficie utile.");
    if (r.fascia) {
      r.valore_proposto = r.fascia[1];
      const scritto = numero(s.valore_mq);
      r.valore = scritto !== null ? scritto : r.valore_proposto;
      if (scritto !== null && scritto > r.fascia[1] + 0.0005) avvisi.push(`Il valore al mq supera il massimo (€ ${virgola(r.fascia[1])} l'anno).`);
      if (scritto !== null && scritto < r.fascia[0] - 0.0005) avvisi.push(`Sotto il minimo (€ ${virgola(r.fascia[0])}): serve l'attestazione di due organizzazioni, una dei proprietari e una degli inquilini.`);
      if (sup) {
        let k = 1;
        if (s.porzione) {
          const p = numero(s.mq_porzione);
          if (p !== null && sup.righe[0].mq) { k = Math.min(1, p / sup.righe[0].mq); r.quota = k; avvisi.push(`Porzione: ${virgola(p)} mq su ${virgola(sup.righe[0].mq)} di superficie utile (${virgola(k * 100)}%); il coefficiente K resta quello dell'intero appartamento.`); }
          else avvisi.push("Porzione: indica i mq della parte locata, compresa la quota delle parti condivise.");
        }
        // l'arredo aumenta il massimo, ma non sulle superfici accessorie
        const annuo = (val, conArredo) => (sup.supK * (conArredo ? 1 + r.arredo / 100 : 1) + sup.supA) * val * k;
        r.canone_minimo = cent(annuo(r.fascia[0], false) / 12);
        r.canone_massimo = cent(annuo(r.fascia[1], true) / 12);
        r.canone = cent(annuo(r.valore, true) / 12);
      }
    }
    const pattuito = numero(s.canone_mensile);
    if (pattuito !== null) {
      r.canone_pattuito = pattuito;
      if (r.canone_massimo !== null && pattuito > r.canone_massimo + 0.005) avvisi.push(`Il canone pattuito supera il massimo (€ ${virgola(r.canone_massimo)} al mese).`);
    }
    return r;
  }

  return { calcola, superficie, subfascia, coefficienteK, numero, virgola };
});

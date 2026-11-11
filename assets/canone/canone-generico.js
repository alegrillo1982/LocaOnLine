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
    // es. Brescia: la superficie utile si aumenta prima (12,5%) e le correzioni guardano il risultato
    const Uc = R.coeff_base ? cent(U * R.coeff_base) : U;
    let base = Uc;
    const c = (R.correzioni || []).find((x) => (x.incluso ? Uc <= x.fino : Uc < x.fino) && (x.da === undefined || Uc >= x.da) && (!x.zone || x.zone.includes(z)));
    if (c && c.imposta !== undefined) {
      base = Math.max(U, c.imposta);
      note.push(`Alloggio da ${virgola(c.da, 0)} a ${virgola(c.fino, 0)} mq: superficie portata a ${virgola(c.imposta, 0)} mq.`);
    } else if (c && c.proporzionale) {
      base = U + U * (c.fino - U) / c.fino;
      note.push(`Da ${c.da} a ${c.fino} mq: aumento proporzionale, superficie x (${c.fino} - mq) / ${c.fino}.`);
    } else if (c) {
      base = Math.max(Uc, Math.min(Uc * (1 + c.perc / 100), c.tetto ?? Infinity));
      if (base > Uc) note.push(`Superficie ${c.perc > 0 ? "aumentata" : "ridotta"} del ${Math.abs(c.perc)}%${c.tetto ? ` (al massimo ${virgola(c.tetto)} mq)` : ""}.`);
    } else if (R.grandi && U > R.grandi.oltre && R.grandi.riduzione) {
      base = Math.max(R.grandi.oltre, U * (1 - R.grandi.riduzione / 100));
      note.push(`Oltre ${R.grandi.oltre} mq la superficie si riduce del ${R.grandi.riduzione}% (non sotto ${R.grandi.oltre} mq).`);
    } else if (R.grandi && U > R.grandi.oltre) {
      base = R.grandi.oltre + (U - R.grandi.oltre) * R.grandi.perc / 100;
      note.push(`Oltre ${R.grandi.oltre} mq la parte eccedente conta il ${R.grandi.perc}%.`);
    }
    const righe = [{ chiave: "base", mq: U, coeff: R.coeff_base || 1, convenzionale: cent(base) }];
    for (const v of R.voci || []) {
      const mq = numero(sup[v.chiave]) || 0;
      const k = v.coeff_zona && v.coeff_zona[z] !== undefined ? v.coeff_zona[z] : v.coeff;
      const lim = v.scaglione && v.scaglione[0] === "base" ? U : v.scaglione && v.scaglione[0];
      let conv = v.scaglione ? Math.min(mq, lim) * v.scaglione[1] + Math.max(0, mq - lim) * v.scaglione[2] : mq * k;
      if (v.oltre_mq !== undefined && mq <= v.oltre_mq) conv = 0;
      if (v.tetto === "base" && conv > U) { conv = U; note.push(`${v.testo}: al massimo la superficie dell'alloggio.`); }
      righe.push({ chiave: v.chiave, mq, coeff: k, convenzionale: cent(conv) });
    }
    let totale = cent(righe.reduce((t, r) => t + r.convenzionale, 0));
    // es. Messina: le pertinenze contano al massimo per una quota della superficie principale
    if (R.tetto_voci) {
      const voci = totale - righe[0].convenzionale, tetto = cent(U * R.tetto_voci);
      if (voci > tetto) { totale = cent(righe[0].convenzionale + tetto); note.push(`Pertinenze contate fino a ${virgola(tetto)} mq (metà della superficie dell'alloggio).`); }
    }
    const ct = (R.correzioni_totale || []).find((x) => (R.correzioni_totale_su === "base" ? U : totale) <= x.fino);
    if (ct && ct.perc) {
      const prima = totale;
      totale = cent(ct.perc > 0 ? Math.max(prima, Math.min(prima * (1 + ct.perc / 100), ct.limite ?? Infinity)) : Math.min(prima, Math.max(prima * (1 + ct.perc / 100), ct.limite ?? 0)));
      if (totale !== prima) note.push(`Superficie ${R.correzioni_totale_su === "base" ? "convenzionale" : "intermedia"} ${virgola(prima)} mq ${ct.perc > 0 ? "aumentata" : "ridotta"} del ${Math.abs(ct.perc)}%${ct.limite ? ` (limite ${virgola(ct.limite)} mq)` : ""}.`);
    }
    // es. Messina: coefficiente di posizione nella microzona (periferia, semiperiferia, centro)
    const CS = R.coeff_scelta, cv = CS && (s.maggiorazioni_scelte || {})[CS.chiave];
    if (cv && CS.valori[cv]) { totale = cent(totale * CS.valori[cv]); note.push(`Superficie moltiplicata per ${virgola(CS.valori[cv])} (${CS.testi[cv]}).`); }
    return { righe, base: cent(base), totale, note };
  }

  /** I punti di un elemento: casella (punti se segnata) o livello scelto (es. stato 0/1/2). */
  const puntiDi = (e, val) => (e.livelli ? (val === "" || val === undefined || val === null || val === false ? 0 : (e.livelli[Number(val)] || {}).punti || 0) : val ? e.punti || 0 : 0);
  const presente = (e, val) => (e.livelli ? val !== "" && val !== undefined && val !== null && val !== false : !!val);

  function fascia(accordo, s, zona) {
    const F = accordo.regole.fasce, el = s.elementi || [], E = accordo.regole.elementi;
    if (F.gruppi) {
      // es. Ancona: ogni gruppo di elementi dà una fascia; il massimo è la media pesata dei massimi
      const gruppi = F.gruppi.map((g) => {
        const n = Math.round(E.slice(g.da, g.a + 1).reduce((t, e, k) => t + puntiDi(e, el[g.da + k]), 0) * 100) / 100;
        let i = g.soglie.findIndex((x) => n <= x); if (i < 0) i = g.soglie.length;
        return { nome: g.nome, n, i, fascia: F.nomi[i], peso: g.peso };
      });
      if (F.combina === "prevalente") {
        // es. Padova: vale il livello che ricorre più spesso fra i gruppi; a parità quello superiore
        const conta = F.nomi.map((_, k) => gruppi.filter((g) => g.i === k).length);
        let i = 0; conta.forEach((c, k) => { if (c >= conta[i]) i = k; });
        // es. Verona: regole proprie per la parità fra due livelli
        const pari = conta.map((c, k) => (c === conta[i] ? k : -1)).filter((k) => k >= 0);
        const regola = pari.length === 2 && F.parita ? F.parita[pari.join("-")] : undefined;
        if (typeof regola === "number") i = regola;
        else if (regola) i = gruppi[regola.gruppo].i === regola.se ? regola.allora : regola.altrimenti;
        return { n: conta[i], i, nome: F.nomi[i], gruppi, prevalente: true, avviso: "" };
      }
      return { n: gruppi.reduce((t, g) => t + g.n, 0), i: null, nome: gruppi.map((g) => `${g.nome} ${g.fascia}`).join(", "), gruppi, avviso: "" };
    }
    if (F.criterio === "differenza") {
      // es. Messina: le percentuali degli elementi si applicano alla differenza fra minimo e massimo
      const n = Math.round(E.reduce((t, e, k) => t + puntiDi(e, el[k]), 0) * 100) / 100;
      return { n, i: 0, nome: `${virgola(Math.min(n, 100), 0)}% della differenza`, avviso: "" };
    }
    if (F.criterio === "obbligatori") {
      // es. Bergamo: per ogni subfascia un numero minimo di elementi, alcuni obbligatori; un obbligatorio
      // mancante si può sostituire con altri elementi (sost), a volte con una riduzione del massimo (penale)
      const flag = (k) => !!(k && (s.maggiorazioni_scelte || {})[k]);
      const basso = flag(F.flag_basso), restauro = flag(F.flag_restauro);
      const n = E.filter((e, k) => presente(e, el[k])).length;
      let i = 0, penale = false;
      F.livelli.forEach((L, k) => {
        if (!L) return;
        let serve = L.totale - (basso ? 1 : 0), ok = true, pen = false;
        for (const o of L.obbligatori) {
          if (basso && o.esente_basso) continue;
          if (o.k.some((j) => presente(E[j], el[j]))) continue;
          const rest = restauro && o.restauro, sost = rest ? 1 : o.sost;
          if (!sost) { ok = false; break; }
          serve += sost - 1; if (o.penale && !rest) pen = true;
        }
        if (ok && n >= serve) { i = k; penale = pen; }
      });
      return { n, i, nome: F.nomi[i], avviso: penale ? F.avviso_penale || "" : "", penale };
    }
    if (F.criterio === "requisiti") {
      // es. Catania: la subfascia più alta di cui l'immobile ha tutti i requisiti (tutti gli A, almeno n B, ...)
      const conta = (q) => E.filter((e, k) => k >= q.da && k <= q.a && presente(e, el[k])).length;
      let i = 0, avviso = "";
      F.requisiti.forEach((req, k) => { if (req && req.every((q) => (q.tutti ? conta(q) === q.a - q.da + 1 : conta(q) >= q.n))) i = k; });
      if (F.blocca && i > F.blocca.fino && conta(F.blocca) > 0) { i = F.blocca.fino; avviso = F.blocca.avviso; }
      return { n: F.conta ? conta(F.conta) : 0, i, nome: F.nomi[i], avviso };
    }
    if (F.criterio === "scelta") {
      const val = (s.maggiorazioni_scelte || {})[F.chiave];
      const i = Math.max(0, F.valori.indexOf(val));
      return { n: 0, i, nome: F.nomi[i], avviso: val ? "" : F.avviso || "" };
    }
    const [da, a] = F.conta ? [F.conta.da, F.conta.a] : [0, E.length - 1];
    const n = F.criterio === "punti" ? E.reduce((t, e, i) => t + (i >= da && i <= a ? puntiDi(e, el[i]) : 0), 0) : E.filter((e, i) => i >= da && i <= a && presente(e, el[i])).length;
    const soglie = (F.soglie_zona && zona && F.soglie_zona[zona.codice]) || F.soglie;
    let i = soglie.findIndex((x) => n <= x);
    if (i < 0) i = soglie.length;
    // es. Catanzaro: alcuni elementi (ristrutturazione recente, APE) bastano da soli per la fascia più alta
    if (F.basta && F.basta.some((k) => presente(E[k], el[k]))) i = Math.max(i, soglie.length);
    const mancano = (F.obbligatori || []).filter((k) => !el[k]);
    let avviso = i > 0 && mancano.length ? `Senza ${mancano.map((k) => `l'elemento ${k + 1}`).join(" e ")} si resta nella fascia più bassa.` : "";
    if (i > 0 && F.almeno) {
      const nb = E.filter((e, k) => k >= F.almeno.da && k <= F.almeno.a && presente(e, el[k])).length;
      if (nb < F.almeno.n) avviso = F.almeno.avviso;
    }
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
      let chiave = tipo === "agevolato" ? String(anni) : "3";
      if (R.tabella_per === "scelta") {
        chiave = (R.tabella_studenti && tipo === "studenti" ? "stud_" : "") + ((s.maggiorazioni_scelte || {})[R.tabella_chiave] || R.tabella_predefinita);
        r.tipologia = chiave;
      }
      if (R.tabella_per === "superficie") {
        const U = numero((s.superfici || {}).base);
        // es. Parma: soglie proprie dell'accordo, [[40,"40"],[60,"60"],...] e la tabella per le superfici oltre
        const TS = R.tabella_soglie;
        chiave = (s.maggiorazioni_scelte || {}).casa ? "casa"
          : TS ? (U === null ? TS[0][1] : ((TS.find((x) => U <= x[0]) || [])[1] || R.tabella_oltre))
          : U === null ? "70" : U <= 45 ? "45" : U <= 70 ? "70" : U <= 120 ? "120" : "oltre";
        r.tipologia = chiave;
      }
      if (R.tabella_per === "conteggio") {
        // es. Taranto: la tabella dipende da quanti elementi di un gruppo sono presenti (stato dello stabile)
        const TC = R.tabella_conta, el = s.elementi || [];
        const n = R.elementi.filter((e, k) => k >= TC.da && k <= TC.a && presente(e, el[k])).length;
        let k = TC.soglie.findIndex((x) => n <= x); if (k < 0) k = TC.soglie.length;
        chiave = TC.valori[k]; r.tipologia = chiave; r.conteggio_tabella = n;
      }
      const tab = Array.isArray(r.zona.fasce) ? r.zona.fasce : r.zona.fasce[chiave] || r.zona.fasce["3"];
      if (f.gruppi && !f.prevalente) {
        const pesi = f.gruppi.reduce((t, g) => t + g.peso, 0);
        const max = Math.round(f.gruppi.reduce((t, g) => t + tab[g.i][1] * g.peso, 0) / pesi * 100) / 100;
        r.base = [Math.round(max * R.fasce.minimo_perc) / 100, max];
      } else if (tab.length === 1 && (R.fasce.nomi_tabella || {})[chiave.replace(/^stud_/, "")]) {
        // es. Catanzaro: le ville hanno una fascia sola, qualunque sia il numero di elementi
        r.base = tab[0]; f.i = 0; f.nome = R.fasce.nomi_tabella[chiave.replace(/^stud_/, "")];
      } else {
        r.base = tab[f.i];
        // es. Prato: per gli alloggi piccoli la tabella è spostata di una fascia, e il nome la segue
        const NT = (R.fasce.nomi_per_tabella || {})[chiave];
        if (NT) f.nome = NT[f.i];
      }
      if (r.base && R.fasce.criterio === "differenza") {
        r.massimo_fascia = r.base[1];
        r.base = [r.base[0], Math.round((r.base[0] + (r.base[1] - r.base[0]) * Math.min(f.n, 100) / 100) * 1000) / 1000];
      }
      if (r.base && f.penale && R.fasce.penale_perc) r.base = [r.base[0], cent(r.base[1] * (1 - R.fasce.penale_perc / 100))];
      // es. Bergamo: classe energetica bassa, massimo ridotto prima delle maggiorazioni
      const RM = R.riduzione_max;
      if (r.base && RM && (s.maggiorazioni_scelte || {})[RM.chiave] && RM.fasce.includes(f.i)) { r.base = [r.base[0], cent(r.base[1] * (1 - RM.perc / 100))]; avvisi.push(RM.avviso); }
      const P = R.fasce.proporzionale && R.fasce.proporzionale[f.i];
      if (P && r.base) {
        const passi = Math.max(0, Math.min(f.n - P.da, P.passi));
        r.base = [r.base[0], Math.round((r.base[0] + (r.base[1] - r.base[0]) / P.passi * passi) * 100) / 100];
        r.massimo_fascia = tab[f.i][1];
      }
    }
    const z = r.zona ? r.zona.codice : "";
    const add = (nome, perc, dopo) => { if (perc) r.maggiorazioni.push({ nome, perc, dopo: !!dopo }); };
    const sup = superficie(accordo, s);
    r.superficie = sup;
    if (sup) avvisi.push(...sup.note); else avvisi.push("Inserisci la superficie.");
    // es. Modena: canoni a corpo per tipologia dimensionale; la superficie controlla solo la classe scelta
    const AC = R.a_corpo;
    if (AC && AC.classi && sup && r.tipologia && AC.classi[r.tipologia]) {
      const U = sup.righe[0].mq, Ur = AC.arrotonda ? Math.round(U) : U, [da, a] = AC.classi[r.tipologia];
      if (Ur < da || (a !== null && Ur > a)) avvisi.push(`La superficie (${virgola(Ur, 0)} mq) non corrisponde alla tipologia scelta: scegli quella giusta.`);
    }
    if (AC && AC.stanze && AC.stanze.includes(r.tipologia)) avvisi.push("Il canone è per una stanza: con più stanze si sommano i canoni di ciascuna.");
    for (const m of R.maggiorazioni || []) {
      if (m.contratti && !m.contratti.includes(tipo)) continue;
      if (!perZona(m, z)) continue;
      const val = (s.maggiorazioni_scelte || {})[m.chiave];
      if (m.tipo === "auto") { add(m.nome || m.testo, m.perc, m.dopo); continue; }
      if (m.tipo === "scelta") { const o = (m.opzioni || []).find((x) => x.valore === val); if (o && o.perc) add(`${m.nome || m.testo}: ${o.testo}`, o.perc, m.dopo); }
      else if (val) add(m.nome || m.testo, m.perc, m.dopo);
    }
    if (R.alternativa) {
      const A = R.alternativa, el = s.elementi || [];
      const n = R.elementi.filter((e, i) => presente(e, el[i])).length;
      const nb = R.elementi.filter((e, i) => i >= A.b.da && i <= A.b.a && presente(e, el[i])).length;
      const sc = A.scaglioni.filter((x) => n >= x.da && nb >= (x.b || 0)).pop();
      const idx = r.maggiorazioni.findIndex((m) => m.nome.startsWith(A.contro));
      if (sc && (idx < 0 || r.maggiorazioni[idx].perc < sc.perc)) {
        if (idx >= 0) r.maggiorazioni.splice(idx, 1);
        add(`${n} elementi (in alternativa alla classe energetica)`, sc.perc);
      }
    }
    if (sup) for (const c of R.correttivi_superficie || []) {
      if (!perZona(c, z)) continue;
      const mq = c.su === "base" ? sup.righe[0].mq : sup.totale;
      if ((c.da === undefined || mq >= c.da) && (c.a === undefined || mq <= c.a)) add(c.nome, c.perc);
    }
    if (R.premium && r.zona) {
      // es. Perugia: elementi "premium" contati a parte, maggiorazione secondo la zona
      const P = R.premium, el = s.elementi || [];
      const np = R.elementi.filter((e, i) => i >= P.da && i <= P.a && presente(e, el[i])).length;
      const sc = P.scaglioni.filter((x) => np >= x.da).pop();
      r.premium = np;
      // es. Verona: la percentuale dipende dalla superficie (fino a 65 mq "piccoli", oltre "grandi")
      const taglia = P.soglia_mq && sup ? (sup.righe[0].mq <= P.soglia_mq ? "piccoli" : "grandi") : null;
      if (sc) add(`${np} ${P.nome || "elementi premium"}`, (taglia ? sc.perc[taglia] : sc.perc[z] ?? sc.perc.altre) ?? 0, P.dopo);
    }
    if (R.arredo && sup) {
      // es. Padova: arredo in proporzione ai punti degli oggetti presenti, fino al massimo dell'accordo
      const A = R.arredo, el = s.elementi || [], piccolo = sup.base <= A.soglia;
      let tot = 0, si = 0;
      for (let k = A.da; k <= A.a; k++) {
        if (piccolo && (A.esclusi_piccoli || []).includes(k)) continue;
        const p = R.elementi[k].punti || 0; tot += p; if (el[k]) si += p;
      }
      r.arredo = { punti: si, totale: tot };
      if (si && tot) add(`arredo (${virgola(si, 1)} su ${virgola(tot, 1)} punti)`, Math.round(si / tot * A.perc * 100) / 100);
    }
    const DU = R.durata_piccoli && sup && sup.righe[0].mq < R.durata_piccoli.soglia ? R.durata_piccoli : R.durata;
    if (tipo === "agevolato" && DU) add(`durata ${s.durata_anni} + 2 anni`, DU[String(anni)] || 0, R.durata_dopo);
    if (R.contratto && R.contratto[tipo]) { add(tipo === "studenti" ? "contratto per studenti" : "contratto transitorio", R.contratto[tipo], R.durata_dopo); if (R.contratto.anche_minimo) r.maggiorazioni[r.maggiorazioni.length - 1].minimo = true; }
    const prima = r.maggiorazioni.filter((m) => !m.dopo), dopo = r.maggiorazioni.filter((m) => m.dopo);
    r.fattore = (R.combinazione === "prodotto"
      ? prima.reduce((k, m) => k * (1 + m.perc / 100), 1)
      : 1 + prima.reduce((t, m) => t + m.perc, 0) / 100) * dopo.reduce((k, m) => k * (1 + m.perc / 100), 1);
    const kMin = r.maggiorazioni.filter((m) => m.minimo).reduce((k, m) => k * (1 + m.perc / 100), 1);
    if (r.base) r.valori = r.base.map((x, i) => (R.solo_massimo && i === 0 ? Math.round(x * kMin * 1000) / 1000 : Math.round(x * r.fattore * 1000) / 1000));
    // es. Messina: le maggiorazioni non superano il massimo della microzona; senza riscaldamento, al massimo -5%
    if (R.tetto_fascia && r.valori && r.massimo_fascia !== undefined) {
      if (r.valori[1] > r.massimo_fascia) { r.valori = [r.valori[0], r.massimo_fascia]; avvisi.push("Il valore si ferma al massimo della microzona (art. 3)."); }
      const SR = R.senza_riscaldamento;
      if (SR && (s.maggiorazioni_scelte || {})[SR.chiave] && r.valori[1] >= r.massimo_fascia - 0.0005) { r.valori = [r.valori[0], Math.round(r.massimo_fascia * (1 - SR.perc / 100) * 1000) / 1000]; avvisi.push(SR.avviso); }
    }
    // es. Parma: alloggi senza servizi essenziali, al massimo il minimo della fascia più una percentuale
    const TM = R.tetto_minimo;
    if (TM && r.valori && r.base && (s.maggiorazioni_scelte || {})[TM.chiave]) {
      r.valori = [r.base[0], Math.round(r.base[0] * (1 + TM.perc / 100) * 1000) / 1000];
      avvisi.push(TM.avviso);
    }
    // es. Brescia: con uno di questi elementi si applica il solo valore minimo
    if (R.solo_minimo && r.valori && R.elementi.some((e, k) => k >= R.solo_minimo.da && k <= R.solo_minimo.a && presente(e, (s.elementi || [])[k]))) {
      r.valori = [r.valori[0], r.valori[0]];
      avvisi.push(R.solo_minimo.avviso);
    }
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
        const q = R.a_corpo ? 1 : sup.totale;
        r.canone_intero = cent(q * r.valore / mese);
        r.canone = cent(r.canone_intero * k);
        r.canone_minimo = cent(q * r.valori[0] / mese * k);
        r.canone_massimo = cent(q * r.valori[1] / mese * k);
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

  return { calcola, superficie, fascia, puntiDi, presente, numero, virgola };
});

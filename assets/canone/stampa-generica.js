/*
 * La scheda del canone in PDF per gli accordi descritti solo con i dati
 * ("regole.generico"). Segue la struttura dei moduli di attestazione degli
 * accordi (parti e immobile, superficie convenzionale, elementi o parametri
 * con le caselle, maggiorazioni, calcolo del canone, dichiarazione e
 * attestazione), con titoli e testi presi da "pdf" nel file dell'accordo:
 *   pdf: {allegato, titolo, sottotitolo, titolo_elementi, dichiarazione, attestazione: [..], firme: [..], piede}
 *
 *   StampaGenerica.creaPDF({ PDFLib, fontkit, regolare, grassetto, icona, sansRegolare, sansGrassetto },
 *                          accordo, scheda, risultato) -> Promise<Uint8Array>
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.StampaGenerica = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const L = 595.28, H = 841.89, SX = 46, DX = 549, FONDO_PAGINA = 770;
  const v = (n, c = 2) => (n === null || n === undefined || n === "" ? "" :
    Number(n).toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }));

  async function creaPDF(ris, accordo, s, r) {
    const { PDFDocument, rgb } = ris.PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(ris.fontkit);
    const reg = await doc.embedFont(ris.regolare, { subset: true });
    const bold = await doc.embedFont(ris.grassetto, { subset: true });
    const A = accordo.accordo, R = accordo.regole, P = accordo.pdf || {};
    doc.setTitle(`Accordo territoriale ${A.comune} - ${P.titolo || "Scheda del canone"}`);
    doc.setCreator("LocaOnLine - locaonline.it");
    const NERO = rgb(0, 0, 0), DATO = rgb(0.05, 0.12, 0.42), GRIGIO = rgb(0.4, 0.4, 0.4), FONDO = rgb(0.92, 0.92, 0.92);
    const largo = (t, f, sz) => f.widthOfTextAtSize(String(t), sz);
    const Y = (a) => H - a;
    const Marchio = ris.marchio || (typeof MarchioPdf !== "undefined" ? MarchioPdf : null);
    const marchio = Marchio ? await Marchio.prepara(doc, ris.PDFLib, { icona: ris.icona, regolare: ris.sansRegolare, grassetto: ris.sansGrassetto }) : null;
    let p, a;
    const pagine = [];
    const nuova = () => { p = doc.addPage([L, H]); pagine.push(p); a = 50; };
    const spazio = (h) => { if (a + h > FONDO_PAGINA) nuova(); };
    const tx = (t, x, aa, { f = reg, sz = 9, c = NERO } = {}) => { p.drawText(String(t), { x, y: Y(aa), size: sz, font: f, color: c }); return x + largo(t, f, sz); };
    const dx = (t, x, aa, o = {}) => tx(t, x - largo(t, o.f || reg, o.sz || 9), aa, o);
    const aCapo = (t, f, sz, w) => {
      const righe = []; let rr = "";
      for (const pa of String(t).split(" ")) { const pr = rr ? rr + " " + pa : pa; if (largo(pr, f, sz) > w && rr) { righe.push(rr); rr = pa; } else rr = pr; }
      if (rr) righe.push(rr); return righe;
    };
    const paragrafo = (t, { sz = 9, f = reg, w = DX - SX, x = SX, passo = 11.5 } = {}) => {
      for (const rr of aCapo(t, f, sz, w)) { spazio(passo); tx(rr, x, a, { sz, f }); a += passo; }
    };
    const riga = (pezzi, sz = 9) => {
      spazio(16);
      let x = SX;
      for (const pz of pezzi) {
        if (typeof pz === "string") { x = tx(pz, x, a, { sz }); continue; }
        p.drawLine({ start: { x, y: Y(a) - 1.5 }, end: { x: x + pz.w, y: Y(a) - 1.5 }, thickness: 0.5, color: NERO });
        if (pz.v) { let t = String(pz.v); while (t && largo(t, reg, sz) > pz.w - 3) t = t.slice(0, -1); tx(t, x + 2, a - 0.5, { sz, c: DATO }); }
        x += pz.w;
      }
      a += 16;
    };
    const sezione = (t) => { spazio(30); a += 4; p.drawRectangle({ x: SX, y: Y(a + 4), width: DX - SX, height: 14, color: FONDO }); tx(t, SX + 4, a, { f: bold, sz: 9.2 }); a += 17; };
    const casella = (x, aa, si) => { p.drawRectangle({ x, y: Y(aa) - 0.5, width: 7, height: 7, borderColor: NERO, borderWidth: 0.6 }); if (si) tx("X", x + 1.3, aa - 0.2, { f: bold, sz: 7, c: DATO }); };
    const per = R.unita === "anno" ? "anno" : "mese";

    nuova();
    if (P.allegato) dx(P.allegato, DX, a, { f: bold, sz: 10 });
    a += 16;
    for (const rr of aCapo((P.titolo || "SCHEDA PER LA DETERMINAZIONE DEL CANONE").toUpperCase(), bold, 11.5, DX - SX)) { tx(rr, (L - largo(rr, bold, 11.5)) / 2, a, { f: bold, sz: 11.5 }); a += 14; }
    const sotto = P.sottotitolo || `${A.titolo} (${A.deposito_data ? `depositato il ${A.deposito_data.replace(/\./g, "/")}` : `sottoscritto il ${A.data_testo}`})`;
    for (const rr of aCapo(sotto, reg, 8.6, DX - SX)) { tx(rr, (L - largo(rr, reg, 8.6)) / 2, a, { sz: 8.6 }); a += 11; }
    a += 6;
    const tipo = s.tipo || "agevolato";
    let x = SX;
    for (const [k, et] of [["agevolato", `agevolato ${tipo === "agevolato" ? `${s.durata_anni || 3}+2` : "3+2"}`], ["transitorio", "transitorio"], ["studenti", "studenti universitari"]]) {
      casella(x, a, tipo === k); x = tx(et, x + 11, a) + 18;
    }
    a += 16;
    riga(["Locatore ", { w: 180, v: s.locatore }, "  C.F. ", { w: 130, v: (s.locatore_cf || "").toUpperCase() }]);
    riga(["Conduttore ", { w: 170, v: s.conduttore }, "  C.F. ", { w: 130, v: (s.conduttore_cf || "").toUpperCase() }]);
    riga([`Immobile in ${A.comune}, `, { w: 170, v: s.indirizzo }, " piano ", { w: 26, v: s.piano }, " Fg. ", { w: 30, v: s.foglio }, " Part. ", { w: 36, v: s.particella }, " Sub. ", { w: 26, v: s.subalterno }]);
    if (r.fascia.gruppi) { riga(["Zona ", { w: 200, v: r.zona ? r.zona.nome : "" }, "  Punteggio ", { w: 40, v: String(r.punti) }]); riga(["Fasce ", { w: 360, v: r.zona ? r.fascia.nome : "" }]); }
    else riga(["Zona ", { w: 190, v: r.zona ? r.zona.nome : "" }, "  Fascia ", { w: 70, v: r.zona ? r.fascia.nome : "" }, R.fasce.criterio === "punti" ? "  Punteggio " : "  Elementi n. ", { w: 40, v: String(r.punti) }]);

    // superficie
    sezione(P.titolo_superficie || "CALCOLO DELLA SUPERFICIE CONVENZIONALE");
    const sup = r.superficie, S = R.superficie || {};
    tx("mq", 360, a - 3, { sz: 7.5, c: GRIGIO }); tx("coeff.", 405, a - 3, { sz: 7.5, c: GRIGIO }); dx("mq conv.", DX, a - 3, { sz: 7.5, c: GRIGIO }); a += 9;
    for (const vo of [{ chiave: "base", testo: S.base || "Superficie dell'alloggio" }, ...(S.voci || [])]) {
      spazio(12);
      const rr = sup ? sup.righe.find((y) => y.chiave === vo.chiave) : null;
      let t = vo.testo; while (largo(t, reg, 8.6) > 300) t = t.slice(0, -1);
      tx(t, SX, a, { sz: 8.6 });
      const k = rr ? rr.coeff : vo.coeff;
      if (k !== undefined) tx(v(k, 2), 405, a, { sz: 8.6 });
      if (rr && rr.mq) { dx(v(rr.mq), 385, a, { sz: 8.6, c: DATO }); dx(v(rr.convenzionale), DX, a, { sz: 8.6, c: DATO }); }
      a += 11.5;
    }
    if (sup && sup.note.length) for (const n of sup.note) { spazio(11); tx(n, SX, a, { sz: 7.8, c: DATO }); a += 10.5; }
    spazio(14); tx("SUPERFICIE CONVENZIONALE COMPLESSIVA mq", 300, a, { f: bold, sz: 9 }); if (sup) dx(v(sup.totale), DX, a, { f: bold, sz: 9, c: DATO }); a += 8;

    // elementi o parametri, su due colonne
    sezione((P.titolo_elementi || (R.fasce.criterio === "punti" ? "PARAMETRI E PUNTEGGI" : "ELEMENTI PRESENTI")).toUpperCase());
    const el = s.elementi || [], E = R.elementi, met = Math.ceil(E.length / 2), w = (DX - SX) / 2 - 12;
    const livello = (i) => { const e = E[i], val = el[i]; return e.livelli && val !== "" && val !== undefined && val !== null && val !== false ? e.livelli[Number(val)] : null; };
    const puntiEl = (i) => (E[i].livelli ? (livello(i) ? livello(i).punti : "") : E[i].punti);
    const righeCol = (i) => aCapo(`${i + 1}) ${E[i].testo}${livello(i) ? `: ${livello(i).testo}` : ""}`, reg, 8, w - 26 - (E[i].punti || E[i].livelli ? 16 : 0));
    for (let k = 0; k < met; k++) {
      const coppia = [k, k + met].filter((i) => i < E.length), alto = Math.max(...coppia.map((i) => righeCol(i).length)) * 9.6 + 2.5;
      spazio(alto);
      coppia.forEach((i, c) => {
        const x0 = SX + c * ((DX - SX) / 2 + 6), si = E[i].livelli ? !!livello(i) : !!el[i];
        casella(x0, a, si);
        righeCol(i).forEach((rr, z) => tx(rr, x0 + 11, a + z * 9.6, { sz: 8, c: si ? DATO : NERO, f: si ? bold : reg }));
        if (puntiEl(i) !== "" && puntiEl(i) !== undefined) dx(String(puntiEl(i)), x0 + w, a, { sz: 8, c: E[i].livelli ? DATO : NERO });
      });
      a += alto;
    }
    spazio(14); a += 2;
    const soglie = (R.fasce.soglie_zona && r.zona && R.fasce.soglie_zona[r.zona.codice]) || R.fasce.soglie;
    const cosa = R.fasce.criterio === "punti" ? "punti" : "elementi";
    if (!r.fascia.gruppi && !soglie.length) tx("Una sola fascia per zona: gli elementi indicano se avvicinarsi al minimo o al massimo.", SX, a, { sz: 7.8 });
    else if (r.fascia.gruppi) tx(r.fascia.gruppi.map((g) => `${g.nome}: ${g.n} punti, fascia ${g.fascia}`).join("   ·   "), SX, a, { sz: 7.8, c: DATO });
    else tx(R.fasce.nomi.map((n, i) => i === 0 ? `${n}: fino a ${soglie[0]} ${cosa}` : i < soglie.length ? `${n}: da ${soglie[i - 1] + 1} a ${soglie[i]}` : `${n}: da ${soglie[i - 1] + 1}`).join("   ·   "), SX, a, { sz: 7.8 });
    dx(`TOTALE ${R.fasce.criterio === "punti" ? "PUNTEGGIO" : "ELEMENTI"} ${r.punti}`, DX, a, { f: bold, sz: 8.6, c: DATO }); a += 10;

    // maggiorazioni e calcolo
    sezione("MAGGIORAZIONI E RIDUZIONI");
    if (!r.maggiorazioni.length) { spazio(12); tx("nessuna", SX, a, { c: DATO }); a += 12; }
    for (const m of r.maggiorazioni) { spazio(12); tx(m.nome, SX, a, { sz: 8.8, c: DATO }); dx(`${m.perc > 0 ? "+" : ""}${v(m.perc, m.perc % 1 ? 1 : 0)}%`, DX, a, { sz: 8.8, c: DATO }); a += 11.5; }
    if (r.maggiorazioni.length > 1) { spazio(12); tx(r.maggiorazioni.some((m) => m.dopo) || R.combinazione === "prodotto" ? "totale (in parte applicate una sull'altra)" : "totale (sommate)", SX, a, { sz: 8.8 }); dx(`${r.fattore >= 1 ? "+" : ""}${v((r.fattore - 1) * 100)}%`, DX, a, { sz: 8.8, c: DATO }); a += 11.5; }

    sezione("CALCOLO DEL CANONE");
    const tab = [
      ["Valori base al mq/" + per, r.base ? `minimo € ${v(r.base[0])}   massimo € ${v(r.base[1])}` : ""],
      ["Valori rettificati al mq/" + per, r.valori ? `minimo € ${v(r.valori[0], 3)}   massimo € ${v(r.valori[1], 3)}` : ""],
      ["Superficie convenzionale", sup ? `${v(sup.totale)} mq` : ""],
      ...(r.quota !== null ? [["Quota della porzione locata", `${v(r.quota * 100)}%`]] : []),
      ["Canone mensile", r.canone_massimo !== null ? `minimo € ${v(r.canone_minimo)}   massimo € ${v(r.canone_massimo)}` : ""],
      ["CANONE MENSILE CONCORDATO TRA LE PARTI", r.canone_pattuito !== null ? `€ ${v(r.canone_pattuito)}  (annuo € ${v(r.canone_pattuito * 12)})` : ""]];
    for (const [k, val] of tab) {
      spazio(13);
      tx(k, SX, a, { sz: 8.8, f: k.startsWith("CANONE") ? bold : reg });
      if (val) dx(val, DX, a, { sz: 8.8, c: DATO });
      p.drawLine({ start: { x: SX, y: Y(a) - 3 }, end: { x: DX, y: Y(a) - 3 }, thickness: 0.3, color: GRIGIO });
      a += 13;
    }
    a += 8;
    if (P.dichiarazione) { paragrafo(P.dichiarazione, { sz: 8.6 }); a += 4; }
    const firme = P.firme || ["Il locatore", "Il conduttore"];
    spazio(26); a += 10;
    firme.forEach((f, i) => { const x0 = SX + i * ((DX - SX) / firme.length); tx(f, x0, a, { sz: 8.8 }); p.drawLine({ start: { x: x0, y: Y(a + 14) }, end: { x: x0 + 190, y: Y(a + 14) }, thickness: 0.5, color: NERO }); });
    a += 26;
    if (P.attestazione) {
      spazio(60); a += 6;
      const t0 = P.titolo_attestazione || "ATTESTAZIONE DI RISPONDENZA";
      tx(t0, (L - largo(t0, bold, 10)) / 2, a, { f: bold, sz: 10 }); a += 16;
      for (const par of P.attestazione) { paragrafo(par, { sz: 8.6 }); a += 3; }
      spazio(30); a += 10;
      const fo = P.firme_attestazione || ["p. l'Organizzazione"];
      fo.forEach((f, i) => { const x0 = SX + i * ((DX - SX) / fo.length); tx(f, x0, a, { sz: 8.8 }); p.drawLine({ start: { x: x0, y: Y(a + 14) }, end: { x: x0 + 190, y: Y(a + 14) }, thickness: 0.5, color: NERO }); });
      a += 24;
    }
    spazio(12);
    tx("Calcolo di LocaOnLine: il modulo segue le voci del modello dell'accordo; i dati dell'organizzazione e della registrazione restano da compilare.", SX, a, { sz: 6.8, c: GRIGIO });

    const piede = P.piede || `${P.allegato ? P.allegato + " dell'" : ""}Accordo territoriale per il Comune di ${A.comune} (${A.deposito_data ? `depositato il ${A.deposito_data.replace(/\./g, "/")}` : `sottoscritto il ${A.data_testo}`}), compilato con LocaOnLine`;
    for (const pg of pagine) {
      pg.drawText(piede, { x: (L - largo(piede, reg, 6.5)) / 2, y: 44, size: 6.5, font: reg, color: GRIGIO });
      if (marchio) Marchio.disegna(doc, ris.PDFLib, pg, marchio, { cx: L / 2, y: 14, campagna: `scheda_canone_${A.comune.toLowerCase().replace(/[^a-z]/g, "")}` });
    }
    return doc.save();
  }

  return { creaPDF };
});

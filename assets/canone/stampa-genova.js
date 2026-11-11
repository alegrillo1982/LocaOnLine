/*
 * La scheda del canone di Genova in PDF: l'allegato 4 dell'Accordo
 * territoriale (depositato il 03/06/2025), "Scheda per la determinazione del
 * canone di contratti agevolati", compilata con i dati della scheda. Due
 * pagine A4 come l'originale; il logo dell'associazione resta in bianco.
 *
 *   StampaGenova.creaPDF({ PDFLib, fontkit, icona, sansRegolare, sansGrassetto },
 *                        accordo, scheda, risultato) -> Promise<Uint8Array>
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.StampaGenova = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const L = 595.28, H = 841.89, SX = 40, DX = 555;
  const v = (n, c = 2) => (n === null || n === undefined || n === "" ? "" :
    Number(n).toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }));

  async function creaPDF(ris, accordo, s, r) {
    const { PDFDocument, rgb } = ris.PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(ris.fontkit);
    const reg = await doc.embedFont(ris.sansRegolare, { subset: true });
    const bold = await doc.embedFont(ris.sansGrassetto, { subset: true });
    doc.setTitle("Accordo territoriale Genova - Scheda per la determinazione del canone");
    doc.setCreator("LocaOnLine - locaonline.it");
    const NERO = rgb(0, 0, 0), DATO = rgb(0.05, 0.12, 0.42), GRIGIO = rgb(0.4, 0.4, 0.4);
    const largo = (t, f, sz) => f.widthOfTextAtSize(String(t), sz);
    const dep = String(accordo.accordo.deposito_data || "").replace(/\./g, "/");
    const tipo = s.tipo || "agevolato", sup = r.superficie;
    let p = null;
    const Y = (a) => H - a;

    const scrivi = (t, x, a, { f = reg, sz = 10, c = NERO, sotto = false } = {}) => {
      p.drawText(String(t), { x, y: Y(a), size: sz, font: f, color: c });
      if (sotto) p.drawLine({ start: { x, y: Y(a) - 1.5 }, end: { x: x + largo(t, f, sz), y: Y(a) - 1.5 }, thickness: 0.7, color: c });
      return x + largo(t, f, sz);
    };
    /** Un campo: linea da x a x+w, con il valore sopra (blu). */
    const campo = (x, a, w, val, sz = 10) => {
      p.drawLine({ start: { x, y: Y(a) - 2 }, end: { x: x + w, y: Y(a) - 2 }, thickness: 0.5, color: NERO });
      if (val !== undefined && val !== null && val !== "") {
        let t = String(val);
        while (t && largo(t, reg, sz) > w - 4) t = t.slice(0, -1);
        p.drawText(t, { x: x + 3, y: Y(a) + 0.5, size: sz, font: reg, color: DATO });
      }
      return x + w;
    };
    const casella = (x, a, si, lato = 7.5) => {
      p.drawRectangle({ x, y: Y(a) - 0.5, width: lato, height: lato, borderColor: NERO, borderWidth: 0.7 });
      if (si) p.drawText("X", { x: x + 1.3, y: Y(a) + 0.4, size: lato, font: bold, color: DATO });
      return x + lato;
    };
    /** Testo a capo entro una larghezza: righe. */
    const aCapo = (t, f, sz, w) => {
      const righe = []; let rr = "";
      for (const parola of String(t).split(" ")) {
        const prova = rr ? rr + " " + parola : parola;
        if (largo(prova, f, sz) > w && rr) { righe.push(rr); rr = parola; } else rr = prova;
      }
      if (rr) righe.push(rr);
      return righe;
    };

    /** La tabella degli elementi, righe da i a j (escluso). */
    const tabella = (a, i, j) => {
      const xN = SX + 16, xT = SX + 40, alto = 18;
      for (let k = i; k < j; k++) {
        const righe = aCapo(accordo.elementi[k] + (k === 1 || k === 3 ? " *" : ""), k === 1 || k === 3 ? bold : reg, 8.8, DX - xT - 8);
        const h = Math.max(alto, 7 + righe.length * 10);
        p.drawRectangle({ x: xN, y: Y(a + h), width: DX - xN, height: h, borderColor: NERO, borderWidth: 0.7 });
        p.drawLine({ start: { x: xT, y: Y(a) }, end: { x: xT, y: Y(a + h) }, thickness: 0.7, color: NERO });
        casella(SX + 1, a + 12, !!(s.elementi || [])[k]);
        const n = String(k + 1);
        scrivi(n, xN + (xT - xN - largo(n, reg, 9)) / 2, a + 12, { sz: 9 });
        righe.forEach((t, z) => scrivi(t, xT + 6, a + 12 + z * 10, { sz: 8.8, f: k === 1 || k === 3 ? bold : reg }));
        a += h;
      }
      return a;
    };

    const Marchio = ris.marchio || (typeof MarchioPdf !== "undefined" ? MarchioPdf : null);
    const marchio = Marchio ? await Marchio.prepara(doc, ris.PDFLib, { icona: ris.icona, regolare: ris.sansRegolare, grassetto: ris.sansGrassetto }) : null;
    const piede = () => {
      const t = `Allegato 4 dell'Accordo territoriale per il Comune di Genova (depositato il ${dep}), compilato con LocaOnLine`;
      p.drawText(t, { x: (L - largo(t, reg, 6.5)) / 2, y: 44, size: 6.5, font: reg, color: GRIGIO });
      if (marchio) Marchio.disegna(doc, ris.PDFLib, p, marchio, { cx: L / 2, y: 14, campagna: "scheda_canone_genova" });
    };

    // ------------------------------------------------------------ pagina 1
    p = doc.addPage([L, H]);
    scrivi("Allegato 4", DX - largo("Allegato 4", bold, 13), 46, { f: bold, sz: 13, sotto: true });
    let t = "Scheda per la determinazione del canone di contratti agevolati (L. 431/98)";
    scrivi(t, (L - largo(t, bold, 13)) / 2, 78, { f: bold, sz: 13, sotto: true });
    t = `Comune di Genova (Accordo territoriale depositato il ${dep})`;
    scrivi(t, (L - largo(t, bold, 11.5)) / 2, 94, { f: bold, sz: 11.5 });
    let a = 114;
    for (const [k, et] of [["agevolato", "contratto agevolato 3+2 (ex art. 2 comma 3 legge 431/98)"],
      ["studenti", "contratto transitorio studenti universitari (ex art. 5 comma 2 legge 431/98)"],
      ["transitorio", "contratto transitorio ordinario (ex art. 5 comma 1 legge 431/98)"]]) {
      casella(SX + 50, a, tipo === k); scrivi(et, SX + 66, a, { sz: 9.5 }); a += 13;
    }
    a += 8;
    const dove = [s.indirizzo, s.piano ? `piano ${s.piano}` : "", s.interno ? `int. ${s.interno}` : ""].filter(Boolean).join(", ");
    campo(scrivi("Immobile sito in ", SX + 10, a, { sz: 9.5 }) + 4, a, DX - SX - 90, [s.citta && s.citta.toUpperCase() !== "GENOVA" ? s.citta : "", dove].filter(Boolean).join(" – "), 9.5);
    a += 22;
    let x = scrivi("Zona ", SX + 10, a, { sz: 9.5 }) + 8;
    x = campo(x, a, 40, r.zona ? r.zona[0] : "", 9.5) + 12;
    x = scrivi("Valori annui:", x, a, { sz: 9.5 }) + 8;
    x = scrivi("minimo di zona ", x, a, { sz: 9.5 }) + 2; x = campo(x, a, 48, r.zona ? v(r.zona[1]) : "", 9.5) + 8;
    x = scrivi("minimo di fascia ", x, a, { sz: 9.5 }) + 2; x = campo(x, a, 48, r.fascia ? v(r.fascia[0]) : "", 9.5) + 8;
    x = scrivi("massimo di fascia ", x, a, { sz: 9.5 }) + 2; campo(x, a, DX - x, r.fascia ? v(r.fascia[1]) : "", 9.5);
    a += 22;
    x = scrivi("Elementi caratteristici (vedi tabella) n° ", SX + 10, a, { sz: 9.5 }) + 4; campo(x, a, 60, String(r.elementi), 9.5);
    x = scrivi("Collocazione in sottofascia ", 340, a, { sz: 9.5 }) + 4; campo(x, a, DX - x, r.zona ? `${r.sub}^` : "", 9.5);
    a += 22;
    const intera = sup && !sup.porzione, porz = sup && sup.porzione;
    casella(SX, a, intera); x = scrivi("Mq. intera unità immobiliare ", SX + 18, a, { sz: 9.5 }) + 30;
    campo(x, a, 70, intera ? v(sup.intera) : "", 9.5);
    x = scrivi("Mq calcolo ", 300, a, { sz: 9.5 }) + 4; campo(x, a, 70, sup ? v(sup.calcolo) : "", 9.5);
    a += 22;
    casella(SX, a, porz); x = scrivi("1) Mq. porzione locata ", SX + 18, a, { sz: 9.5 }) + 30;
    campo(x, a, 60, porz ? s.mq_porzione : "", 9.5);
    x = scrivi("2) Mq quota parti comuni ", 245, a, { sz: 9.5 }) + 4; campo(x, a, 50, porz ? s.mq_comuni : "", 9.5);
    x = scrivi("Mq. (1+2) Totale Locato ", 420, a, { sz: 9.5 }) + 2; campo(x, a, DX - x, porz ? v(sup.calcolo) : "", 9.5);
    a += 22;
    scrivi("Maggiorazioni valori:", SX, a, { sz: 9.5 }); a += 17;

    // le righe delle maggiorazioni: valori al mq con le maggiorazioni fino a quella riga
    const righe = Object.fromEntries(r.maggiorazioni.map((m) => [m.riga, m]));
    let cumulo = 0;
    const valori = (chiave, aa) => {
      const m = righe[chiave];
      if (m) cumulo += m.percento;
      const k = 1 + cumulo / 100, ok = m && r.fascia;
      let xx = scrivi("minimo ", 370, aa, { sz: 9.5 }) + 4; campo(xx, aa, 64, ok ? v(r.fascia[0] * k) : "", 9.5);
      xx = scrivi("massimo ", 470, aa, { sz: 9.5 }) + 4; campo(xx, aa, DX - xx, ok ? v(r.fascia[1] * k) : "", 9.5);
    };
    const arr = righe.arredo;
    casella(SX, a, !!arr); scrivi("arredato 3+2", SX + 18, a, { sz: 9.5 });
    casella(SX + 115, a, arr && s.arredo === "totale"); scrivi("+12% totale", SX + 131, a, { sz: 9.5 });
    casella(SX + 200, a, arr && s.arredo === "parziale"); scrivi("+6% parziale", SX + 216, a, { sz: 9.5 });
    valori("arredo", a); a += 16;
    const anni = Number(s.durata_anni) || 3;
    casella(SX, a, !!righe.durata); scrivi("durata", SX + 18, a, { sz: 9.5 });
    [[4, "4+2 (+2%)"], [5, "5+2 (+4%)"], [6, "6+2 (+6%)"]].forEach(([n, et], z) => {
      casella(SX + 115 + z * 70, a, !!righe.durata && anni === n); scrivi(et, SX + 131 + z * 70, a, { sz: 9.5 });
    });
    valori("durata", a); a += 16;
    casella(SX, a, !!righe.studenti); scrivi("transitorio studenti (+12%)", SX + 18, a, { sz: 9.5 }); valori("studenti", a); a += 16;
    casella(SX, a, !!righe.transitorio);
    scrivi(`transitorio ordinario (+16%)${righe.transitorio ? `   applicato +${righe.transitorio.percento}%` : ""}`, SX + 18, a, { sz: 9.5 });
    valori("transitorio", a); a += 16;
    casella(SX, a, s.vincolo === "immobile"); scrivi("immobile vincolato (+30%)", SX + 18, a, { sz: 9.5 });
    casella(SX + 160, a, s.vincolo === "fabbricato"); scrivi("fabbricato vincolato (+15%)", SX + 176, a, { sz: 9.5 });
    valori("vincolo", a); a += 22;

    const canone = (et, etMin, aa, div) => {
      scrivi(et, SX, aa, { f: bold, sz: 10, sotto: true });
      let xx = scrivi(etMin, 200, aa, { sz: 9.5 }) + 4; campo(xx, aa, 82, r.annuo_minimo_zona !== null ? v(r.annuo_minimo_zona / div) : "", 9.5);
      xx = scrivi("minimo ", 370, aa, { f: bold, sz: 9.5 }) + 4; campo(xx, aa, 64, r.annuo_minimo !== null ? v(r.annuo_minimo / div) : "", 9.5);
      xx = scrivi("massimo ", 470, aa, { f: bold, sz: 9.5 }) + 4; campo(xx, aa, DX - xx, r.annuo_massimo !== null ? v(r.annuo_massimo / div) : "", 9.5);
    };
    canone("CANONE ANNUO EURO:", "minimo di zona:", a, 1); a += 20;
    canone("CANONE MENSILE EURO:", "minimo zona:", a, 12); a += 22;
    t = "TABELLA DEGLI ELEMENTI CARATTERISTICI DI RIFERIMENTO DELLE UNITA’ IMMOBILIARI ABITATIVE";
    scrivi(t, (L - largo(t, bold, 9.5)) / 2, a, { f: bold, sz: 9.5 }); a += 6;
    tabella(a, 0, 18);
    piede();

    // ------------------------------------------------------------ pagina 2
    p = doc.addPage([L, H]);
    a = tabella(50, 18, accordo.elementi.length) + 18;
    const piccolo = (tt, xx, aa, f = reg) => scrivi(tt, xx, aa, { sz: 6.8, f });
    let xx = piccolo("SOTTOFASCE", SX, a, bold);
    p.drawLine({ start: { x: SX, y: Y(a) - 1.2 }, end: { x: xx, y: Y(a) - 1.2 }, thickness: 0.5, color: NERO });
    piccolo(" [*voci 2 e 4 obbligatorie per accedere alle sottofasce superiori alla 1^]:", xx, a);
    ["1^ sottofascia  da 1 a 2 caratteristiche", "2^ sottofascia  da 3 a 8 caratteristiche", "3^ sottofascia  da 9 a 21 caratteristiche"]
      .forEach((tt, z) => piccolo(tt, SX + 12, a + 10 + z * 9.5));
    xx = piccolo("MAGGIORAZIONI", 282, a, bold);
    p.drawLine({ start: { x: 282, y: Y(a) - 1.2 }, end: { x: xx, y: Y(a) - 1.2 }, thickness: 0.5, color: NERO });
    piccolo(" (escluse locazioni a porzione):", xx, a);
    ["MQ UTILI INFERIORI A MQ 45 = aumento del 30% (fino al limite massimo di mq 54)",
      "MQ COMPRESI TRA 45 – 60 = aumento del 20% (fino al limite massimo di mq 67)",
      "MQ SUP. UTILE COMPRESA TRA 61 – 69 = aumento del 10% (fino a un massimo di mq 70)",
      "MQ UTILI SUPERIORI A MQ 100 = la superficie eccedente i mq 100 si intende ridotta del 30%"]
      .forEach((tt, z) => { p.drawCircle({ x: 288, y: Y(a + 10 + z * 9.5) + 2.3, size: 1.5, color: NERO }); scrivi(tt, 293, a + 10 + z * 9.5, { sz: 6.8 }); });
    a += 66;
    campo(scrivi("Data", SX, a, { sz: 8, f: bold }) + 6, a, 200);
    a += 34;
    const firme = (aa) => {
      campo(scrivi("Il locatore ", SX + 30, aa, { sz: 10 }) + 2, aa, 190);
      campo(scrivi("Il conduttore ", 340, aa, { sz: 10 }) + 2, aa, DX - 340 - largo("Il conduttore ", reg, 10) - 2);
    };
    firme(a); a += 30;
    aCapo("Le parti contraenti dichiarano che i dati sopra esposti sono stati da loro forniti e manlevano l’associazione da ogni responsabilità per l’eventuale erroneità di detti dati.", reg, 10, DX - SX)
      .forEach((tt) => { scrivi(tt, SX, a, { sz: 10 }); a += 13; });
    a += 18;
    firme(a); a += 40;

    // il riepilogo del calcolo, in grigio: non fa parte del modello
    const note = [];
    if (r.fascia && r.canone_massimo !== null) {
      note.push(`Zona ${r.zona[0]}, ${r.sub}^ sottofascia (${r.elementi} elementi): da € ${v(r.fascia[0])} a € ${v(r.fascia[1])} al mq l'anno` +
        (r.percento ? `; maggiorazioni +${r.percento}% (${r.maggiorazioni.map((m) => `${m.nome} +${m.percento}%`).join(", ")})` : "") + ".");
      note.push(`Superficie per il calcolo ${v(sup.calcolo)} mq; valore applicato € ${v(r.valore, 3)} al mq l'anno: canone € ${v(r.canone_annuo)} l'anno, € ${v(r.canone)} al mese; massimo € ${v(r.canone_massimo)} al mese.`);
      if (r.canone_pattuito !== null) note.push(`Canone pattuito: € ${v(r.canone_pattuito)} al mese (€ ${v(r.canone_pattuito * 12)} l'anno).`);
    }
    note.push(`Sottofasce: l'accordo del 2025 non indica come si divide la fascia; qui si usa la regola dell'accordo precedente (25% inferiore, 50% intermedia, 25% superiore).`);
    p.drawText("Calcolo di LocaOnLine (non fa parte del modello):", { x: SX, y: Y(a), size: 7.5, font: reg, color: GRIGIO }); a += 10;
    for (const n of note) for (const tt of aCapo(n, reg, 7.5, DX - SX)) { p.drawText(tt, { x: SX, y: Y(a), size: 7.5, font: reg, color: GRIGIO }); a += 9.5; }
    piede();
    return doc.save();
  }

  return { creaPDF };
});

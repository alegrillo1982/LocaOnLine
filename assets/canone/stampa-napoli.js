/*
 * La scheda del canone di Napoli in PDF: l'allegato "H" dell'Accordo
 * territoriale del 29 aprile 2025, "Scheda determinativa del canone
 * concordato", compilata con i dati della scheda. Una pagina A4.
 *
 *   StampaNapoli.creaPDF({ PDFLib, fontkit, regolare, grassetto, icona, sansRegolare, sansGrassetto },
 *                        accordo, scheda, risultato) -> Promise<Uint8Array>
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.StampaNapoli = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const L = 595.28, H = 841.89, SX = 48, DX = 547;
  const v = (n, c = 2) => (n === null || n === undefined || n === "" ? "" :
    Number(n).toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }));

  async function creaPDF(ris, accordo, s, r) {
    const { PDFDocument, rgb } = ris.PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(ris.fontkit);
    const reg = await doc.embedFont(ris.regolare, { subset: true });
    const bold = await doc.embedFont(ris.grassetto, { subset: true });
    doc.setTitle("Accordo territoriale Napoli 2025 - Scheda determinativa del canone concordato");
    doc.setCreator("LocaOnLine - locaonline.it");
    const NERO = rgb(0, 0, 0), DATO = rgb(0.05, 0.12, 0.42), GRIGIO = rgb(0.4, 0.4, 0.4);
    const p = doc.addPage([L, H]);
    const Y = (a) => H - a;
    const largo = (t, f, sz) => f.widthOfTextAtSize(String(t), sz);
    const scrivi = (t, x, a, { f = reg, sz = 9, col = NERO, centro = false, destra = false } = {}) => {
      t = String(t ?? ""); if (!t) return 0;
      const w = largo(t, f, sz);
      p.drawText(t, { x: centro ? x - w / 2 : destra ? x - w : x, y: Y(a), size: sz, font: f, color: col });
      return w;
    };
    const dato = (t, x, a, sz = 9) => scrivi(t, x, a, { sz, col: DATO });
    const riga = (x1, x2, a, sp = 0.5) => p.drawLine({ start: { x: x1, y: Y(a) }, end: { x: x2, y: Y(a) }, thickness: sp, color: NERO });
    const verticale = (x, a1, a2) => p.drawLine({ start: { x, y: Y(a1) }, end: { x, y: Y(a2) }, thickness: 0.5, color: NERO });
    const casella = (x, a, segnata, lato = 7) => {
      p.drawRectangle({ x, y: Y(a), width: lato, height: lato, borderColor: NERO, borderWidth: 0.6 });
      if (segnata) {
        const m = 1.4;
        p.drawLine({ start: { x: x + m, y: Y(a) + m }, end: { x: x + lato - m, y: Y(a) + lato - m }, thickness: 1, color: DATO });
        p.drawLine({ start: { x: x + m, y: Y(a) + lato - m }, end: { x: x + lato - m, y: Y(a) + m }, thickness: 1, color: DATO });
      }
    };
    const perc = (nome) => { const c = r.correttivi.find((x) => x.nome === nome || x.nome.startsWith(nome)); return c ? c.percento : null; };
    const valoreMq = r.valore;

    // ------------------------------------------------------- intestazione
    let a = 40;
    scrivi("Allegato “H”", L / 2, a, { f: bold, sz: 11, centro: true }); a += 14;
    const tit = "SCHEDA DETERMINATIVA DEL CANONE CONCORDATO";
    scrivi(tit, L / 2, a, { f: bold, sz: 11.5, centro: true }); riga(L / 2 - largo(tit, bold, 11.5) / 2, L / 2 + largo(tit, bold, 11.5) / 2, a + 2, 0.7); a += 12;
    scrivi("(ART. 2 COMMA 3 ED ART. 5 COMMA 1-2-3 legge 9.12.98 N. 431 e D.M. 16.01.2017)", L / 2, a, { f: bold, sz: 7.5, centro: true }); a += 16;
    const anni = s.tipo === "agevolato" ? String(s.durata_anni || 3) : "";
    let x = SX + 6 + scrivi("Contratto abitativo:", SX + 6, a, { sz: 10 });
    riga(x + 3, x + 18, a + 1); dato(anni, x + 6, a); x += 20; x += scrivi("+2 anni", x, a, { sz: 10 }) + 12;
    x += scrivi("Studenti universitari:", x, a, { sz: 10 }); riga(x + 3, x + 50, a + 1); if (s.tipo === "studenti") dato(s.mesi, x + 8, a); x += 52;
    x += scrivi("mesi", x, a, { sz: 10 }) + 12;
    x += scrivi("Transitorio:", x, a, { sz: 10 }); riga(x + 3, x + 50, a + 1); if (s.tipo === "transitorio") dato(s.mesi, x + 8, a); x += 52;
    scrivi("mesi", x, a, { sz: 10 }); a += 16;
    x = SX + scrivi("LOCAZIONE:", SX, a, { sz: 10 }) + 6;
    casella(x, a, !s.parziale); x += 11; x += scrivi("Intera", x, a, { sz: 10 }) + 10;
    casella(x, a, !!s.parziale); x += 11; scrivi("Parziale", x, a, { sz: 10 }); a += 14;
    scrivi("LOCATORE:", SX, a, { sz: 10 }); dato(s.locatore, SX + 62, a);
    scrivi("IMMOBILE:", 300, a, { sz: 10 }); dato([s.indirizzo, s.citta].filter(Boolean).join(", "), 352, a, 8.5); a += 14;
    scrivi("CONDUTTORE:", SX, a, { sz: 10 }); dato(s.conduttore, SX + 74, a);
    scrivi("DATI CATASTALI:", 300, a, { sz: 10 });
    dato([s.sezione && `sez. ${s.sezione}`, s.foglio && `fg. ${s.foglio}`, s.particella && `part. ${s.particella}`, s.subalterno && `sub ${s.subalterno}`].filter(Boolean).join(" "), 386, a, 8.5);
    a += 14;

    // --------------------------------------------------------- superficie
    scrivi("Calcolo della superficie convenzionale dell’unità abitativa: (Sup. abitabile, scoperta, pertinenziale e comune)", SX, a, { f: bold, sz: 8.6 }); a += 4;
    const sup = {}; for (const rg of r.righe || []) sup[rg.chiave] = rg;
    const sinistra = ["utile", "pa_scoperto_pert", "cantine", "balconi", "scoperta", "pa_scoperto_comune"];
    const destra = ["box", "soppalco", "pa_coperto_pert", "pa_coperto_comune", "fruibile"];
    const MX = (SX + DX) / 2, HR = 15;
    const cella = (chiave, x1, x2, aa) => {
      const def = accordo.regole.superficie.find((d) => d.chiave === chiave), q = sup[chiave] || {};
      scrivi(`${def.etichetta.replace(/^Superficie/, "Superficie")}: mq`, x1 + 4, aa + 10.5, { sz: 7.6 });
      if (q.mq !== null && q.mq !== undefined) dato(v(q.mq), x2 - 92, aa + 10.5, 7.8);
      scrivi(`x${v(def.coeff)}= mq`, x2 - 58, aa + 10.5, { sz: 7.6 });
      if (q.convenzionale !== null && q.convenzionale !== undefined) dato(v(q.convenzionale), x2 - 22, aa + 10.5, 7.8);
    };
    const inizio = a;
    riga(SX, DX, a);
    for (let i = 0; i < 6; i++) {
      cella(sinistra[i], SX, MX, a);
      if (destra[i]) cella(destra[i], MX, DX, a);
      else {
        scrivi("Sup. a verde condominiale: mq", MX + 4, a + 10.5, { sz: 7.6 }); if (s.verde_mq) dato(s.verde_mq, MX + 112, a + 10.5, 7.8);
        scrivi("x mm", MX + 132, a + 10.5, { sz: 7.6 }); if (s.verde_millesimi) dato(s.verde_millesimi, MX + 150, a + 10.5, 7.8);
        scrivi("/1000 x 0,10=mq", MX + 168, a + 10.5, { sz: 7.6 }); if (r.verde) dato(v(r.verde), DX - 22, a + 10.5, 7.8);
      }
      a += HR; riga(SX, DX, a);
    }
    scrivi("Totale superficie = mq", SX + 40, a + 11, { f: bold, sz: 8.6 }); if (r.totale) dato(v(r.totale), SX + 146, a + 11);
    scrivi("Superficie locata = mq", MX - 40, a + 11, { f: bold, sz: 8.6 }); if (r.superficie_locata) dato(v(r.superficie_locata), MX + 66, a + 11);
    a += HR; riga(SX, DX, a);
    verticale(SX, inizio, a); verticale(DX, inizio, a); verticale(MX, inizio, a - HR);
    a += 12;
    x = SX + scrivi("AREA OMOGENEA:", SX, a, { f: bold, sz: 9.5 }); if (r.area) dato(String(r.area), x + 6, a, 10);
    x = 170 + scrivi("VALORE MIN: €", 170, a, { f: bold, sz: 9.5 }); if (r.valori) dato(v(r.valori[0]), x + 4, a);
    x = 330 + scrivi("VALORE MAX: €", 330, a, { f: bold, sz: 9.5 }); if (r.valori) dato(v(r.valori[1]), x + 4, a);
    if (r.area && r.area !== r.area_foglio) scrivi(`(foglio in area ${r.area_foglio}, strada rimodulata)`, 452, a, { sz: 6.5, col: GRIGIO });
    a += 12;

    // ------------------------------------------------------------ elementi
    scrivi("ELEMENTI CARATTERISTICI:", SX, a, { f: bold, sz: 9.5 }); a += 4;
    const el = s.elementi || [];
    const inizioEl = a, RE = 11.2, LARGO = MX - SX - 36;
    // le voci lunghe vanno a capo, come nel modello
    const aCapo = (testo) => {
      const out = []; let rr = "";
      for (const parola of testo.split(" ")) {
        const prova = rr ? rr + " " + parola : parola;
        if (largo(prova, reg, 7.6) > LARGO && rr) { out.push(rr); rr = parola; } else rr = prova;
      }
      if (rr) out.push(rr);
      return out;
    };
    for (let i = 0; i < 11; i++) {
      const coppia = [[i, SX], [i + 11, MX]], righe = coppia.map(([k]) => (k === 16 ? [""] : aCapo(accordo.elementi[k])));
      for (const [j, [k, x1]] of coppia.entries()) {
        casella(x1 + 22, a + 9, !!el[k], 6.5);
        scrivi(`${k + 1})`, x1 + 18, a + 9, { sz: 7.6, destra: true });
        if (k === 16) {
          let xx = x1 + 32 + scrivi("u.a. con classe energetica:", x1 + 32, a + 9, { sz: 7.6 }) + 6;
          for (const c of ["A", "B", "C", "D"]) { casella(xx, a + 9, s.classe === c, 6.5); xx += 9; xx += scrivi(c, xx, a + 9, { sz: 7.6 }) + 8; }
        } else righe[j].forEach((rg, n) => scrivi(rg, x1 + 32, a + 9 + n * 8.8, { sz: 7.6 }));
      }
      a += RE + (Math.max(righe[0].length, righe[1].length) - 1) * 8.8;
    }
    p.drawRectangle({ x: SX, y: Y(a + 2), width: DX - SX, height: a + 2 - inizioEl, borderColor: NERO, borderWidth: 0.5 });
    verticale(MX, inizioEl, a + 2);
    a += 13;
    x = SX + scrivi("TOTALE ELEMENTI:", SX, a, { f: bold, sz: 9.5 }); dato(String(r.elementi), x + 6, a, 10);
    x = 250 + scrivi("FASCIA:", 250, a, { f: bold, sz: 9.5 }); if (r.fascia) dato(`${r.fascia}^` + (r.fascia_valori ? `  (da ${v(r.fascia_valori[0])} a ${v(r.fascia_valori[1])} €/mq)` : ""), x + 6, a);
    a += 13;
    x = SX + scrivi("STATO DI CONSERVAZIONE DELL’UNITA’ ABITATIVA:", SX, a, { f: bold, sz: 9.5 }) + 6;
    for (const [val, nome] of [["ottimo", "ottimo"], ["normale", "normale"], ["mediocre", "mediocre"]]) {
      casella(x, a, s.stato === val); x += 10; x += scrivi(nome, x, a, { sz: 9.5 }) + 10;
    }
    a += 16;

    // ---------------------------------------------- valore e correttivi
    x = SX + scrivi("VALORE ANNUO CONCORDATO: €/mq", SX, a, { f: bold, sz: 9.5 }); riga(x + 4, x + 70, a + 1); if (valoreMq !== null) dato(v(valoreMq), x + 8, a);
    a += 12;
    scrivi("Maggiorazioni e/o Riduzioni del valore al mq annuo:", SX, a, { f: bold, sz: 9.5 }); a += 11.5;
    const euroMq = (pc) => (pc === null || valoreMq === null ? "" : v(Math.abs(valoreMq * pc / 100)));
    const linea = (testo, pc, segno = "+") => {
      const w = scrivi(testo, SX, a, { sz: 8.4 });
      if (pc !== null) { dato(`${Math.abs(pc)}%`, SX + w + 4, a, 8.4); dato(`${segno}€ ${euroMq(pc)}`, DX - 70, a, 8.4); }
      a += 11.2;
    };
    const arr = s.arredo === "completo" ? perc("ammobiliato") : null, parz = s.arredo === "parziale" ? perc("parzialmente") : null;
    linea("1) u.a. ammobiliata: % (per studenti e uso abitativo max 15%, uso transitorio ordinari max 25%):", arr);
    linea("2) u.a. parzialmente ammobiliata (almeno cucina e camera da letto) (per contratti ordinari max 7%):", parz);
    linea(`3) contratto di durata anni: ${s.tipo === "agevolato" ? (s.durata_anni || 3) : "__"} + % (max 12%):`, perc("durata"));
    linea("4) contratto transitorio ordinario + % (max 20%):", perc("contratto transitorio"));
    linea("5) u.a. con uno o più affacci con ampia veduta libera: + % (max 10%):", perc("ampia veduta"));
    const pr = perc("strada di pregio");
    linea("6) u.a. in strada di pregio: +/- % (max +/- 30%):", pr, pr !== null && pr < 0 ? "-" : "+");
    linea("7) u.a. in strada non ricompresa negli elenchi di cui al precedente punto 6) - % (Riduzione max 30%):", perc("strada non di pregio"), "-");
    linea("8) unità abitativa di superficie inferiore a 80 mq: + %:", perc("superficie inferiore"));
    linea("9) unità abitativa di superficie superiore a 130 mq: - % (Riduzione max 30%):", perc("superficie superiore"), "-");
    linea("10) edif. e/o u.a. con impianti di risparmio energetico: + % (max 10%):", perc("impianti di risparmio"));
    linea("11) u.a. in edif. unifamiliare o plurifamiliare con annessa area giardinata + % (max 30%):", perc("area giardinata"));
    linea("12) u.a. al piano terra su fronte strada - “Basso Napoletano”: - % (Riduzione dal 5% al 10%):", perc("\"basso"), "-");
    a += 2;
    const totEuro = valoreMq === null ? "" : `${r.totale_perc >= 0 ? "+" : "-"}${v(Math.abs(valoreMq * r.totale_perc / 100))}`;
    x = SX + scrivi("TOTALE COEFFICIENTI CORRETTIVI: +/- €/mq.", SX, a, { f: bold, sz: 9.5 }); dato(`${totEuro} (${r.totale_perc >= 0 ? "+" : ""}${r.totale_perc}%)`, x + 6, a);
    a += 12;
    x = SX + scrivi("VALORE ANNUO APPLICATO (A+/-B): €/mq.", SX, a, { f: bold, sz: 9.5 }); if (r.valore_applicato !== null) dato(v(r.valore_applicato), x + 6, a);
    a += 8;

    // ------------------------------------------------------- calcolo canone
    const C0 = SX, C1 = 155, C2 = 270, C3 = 370, C4 = 460;
    p.drawRectangle({ x: C0, y: Y(a + 44), width: DX - C0, height: 44, borderColor: NERO, borderWidth: 0.5 });
    riga(C0, DX, a + 13); verticale(C1, a + 13, a + 44);
    for (const xx of [C2, C3, C4]) verticale(xx, a + 13, a + 44);
    riga(C1, DX, a + 26);
    scrivi("CALCOLO DEL CANONE", (C0 + DX) / 2, a + 10, { f: bold, sz: 9.5, centro: true });
    scrivi("Val. annuo applicato €/mq.", (C1 + C2) / 2, a + 23, { sz: 8.2, centro: true });
    scrivi("Sup. locata Mq.", (C2 + C3) / 2, a + 23, { sz: 8.2, centro: true });
    scrivi("Canone annuo €", (C3 + C4) / 2, a + 23, { sz: 8.2, centro: true });
    scrivi("Canone mensile €", (C4 + DX) / 2, a + 23, { sz: 8.2, centro: true });
    scrivi("Canone pattuito", C0 + 6, a + 40, { f: bold, sz: 9 });
    const annuo = r.canone_pattuito_annuo !== null ? r.canone_pattuito_annuo : r.canone_annuo;
    const applicato = r.canone_pattuito_annuo !== null && r.superficie_locata ? r.canone_pattuito_annuo / r.superficie_locata : r.valore_applicato;
    if (applicato !== null && applicato !== undefined) dato(v(applicato), (C1 + C2) / 2 - 15, a + 38);
    if (r.superficie_locata) dato(v(r.superficie_locata), (C2 + C3) / 2 - 15, a + 38);
    if (annuo !== null) { dato(v(annuo), (C3 + C4) / 2 - 20, a + 38); dato(v(annuo / 12), (C4 + DX) / 2 - 18, a + 38); }
    a += 56;

    // ---------------------------------------------------- dichiarazione e firme
    const dich = "Le parti, con la sottoscrizione della presente scheda, dichiarano sotto la propria responsabilità, civile e penale, la veridicità di tutti i dati sopra riportati; riconoscono inoltre l’effettiva presenza degli elementi caratteristici dichiarati, sia per l’edificio che per l’unità abitativa, e che le misure su cui è stata computata la superficie convenzionale sono conformi all’effettivo stato dei luoghi; pertanto, riconoscono che il canone annuo pattuito è stato determinato con l’applicazione a tali dati dei parametri di cui all’Accordo Territoriale.";
    let rigaT = "";
    for (const parola of dich.split(" ")) {
      const prova = rigaT ? rigaT + " " + parola : parola;
      if (largo(prova, reg, 8.2) > DX - SX) { scrivi(rigaT, SX, a, { sz: 8.2 }); a += 10; rigaT = parola; } else rigaT = prova;
    }
    scrivi(rigaT, SX, a, { sz: 8.2 }); a += 22;
    x = SX + scrivi("NAPOLI", SX, a, { f: bold, sz: 9 }); riga(x + 4, x + 70, a + 1);
    x = 160 + scrivi("PARTE LOCATRICE", 160, a, { f: bold, sz: 9 }); riga(x + 4, x + 104, a + 1);
    x = 372 + scrivi("PARTE CONDUTTRICE", 372, a, { f: bold, sz: 9 }); riga(x + 4, DX, a + 1);

    // in fondo: la nota e l'invito di LocaOnLine
    const t = "Allegato H dell'Accordo territoriale per il Comune di Napoli del 29 aprile 2025 (depositato il 24/07/2025), compilato con LocaOnLine";
    p.drawText(t, { x: (L - largo(t, reg, 6.5)) / 2, y: 44, size: 6.5, font: reg, color: GRIGIO });
    const Marchio = ris.marchio || (typeof MarchioPdf !== "undefined" ? MarchioPdf : null);
    if (Marchio) Marchio.disegna(doc, ris.PDFLib, p,
      await Marchio.prepara(doc, ris.PDFLib, { icona: ris.icona, regolare: ris.sansRegolare, grassetto: ris.sansGrassetto }),
      { cx: L / 2, y: 14, campagna: "scheda_canone_napoli" });
    return doc.save();
  }

  return { creaPDF };
});

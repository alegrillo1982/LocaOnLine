/*
 * Il contratto di locazione, dai dati al testo: una sequenza di blocchi
 * (intestazione, paragrafi, titoli, firme) da cui nascono sia il PDF sia il
 * Word. Versione per LocaOnLine, dal portale UPPI Roma (9 novembre 2026):
 * l'associazione che assiste le parti la indica chi compila (vuota: righe da
 * compilare), il Comune viene dal file dell'accordo, e la firma "per
 * prestata assistenza" c'e' solo nei concordati o con un'associazione.
 * Il testo e' quello dei modelli dell'UPPI (schemi del DM 16/01/2017
 * adattati), con i riferimenti all'accordo presi dal file dell'accordo.
 *
 * Gira nel browser e con Node. Richiede Lettere (lettere.js).
 *
 *   Contratto.genera(dati, accordo, impostazioni) -> [blocchi]
 *
 * Blocchi:
 *   { t: "intestazione", righe: [{ testo, g, s, sottolinea }] }   logo + riquadro
 *   { t: "centro", testo, g, s }                                   riga centrata
 *   { t: "titolo", testo }                                         Articolo n (...)
 *   { t: "par", parti: [{ testo, g }], s, rientro }                paragrafo giustificato
 *   { t: "firme", righe: [[sinistra, destra]] }                    righe delle firme
 *   { t: "spazio", h }                                             spazio verticale (punti)
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica(require("./lettere.js"));
  else radice.Contratto = fabbrica(radice.Lettere);
})(typeof self !== "undefined" ? self : this, function (Lettere) {
  "use strict";

  const RIGA = "________________";
  const pieno = (v) => v !== undefined && v !== null && String(v).trim() !== "";
  const o = (v, vuoto = RIGA) => (pieno(v) ? String(v).trim() : vuoto);
  const data = (iso) => {
    if (!pieno(iso)) return RIGA;
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
  };
  const euro = (n) => (pieno(n) && Number(n) ? `€ ${Lettere.cifre(n)} (${Lettere.euro(n)})` : `€ ${RIGA} (${RIGA})`);
  const elenco = (voci) => voci.length <= 1 ? voci.join("") : voci.slice(0, -1).join(", ") + " e " + voci[voci.length - 1];
  const P = (testo, g = false) => ({ testo, g });

  // ------------------------------------------------------------ persone

  const femmina = (p) => p && p.sesso === "F";
  /** Il nome in grassetto, con il cognome maiuscolo: "**Paolo TERRENO**". */
  function nome(p) {
    if (p.tipo === "giuridica") return [P(o(p.denominazione), true)];
    return [P((pieno(p.nome) ? p.nome.trim() + " " : "") + o(p.cognome).toUpperCase(), true)];
  }
  const cf = (v) => [P(" "), P(`C.F. ${o(v)}`, true)];
  const nascita = (p) => {
    const luogo = pieno(p.nascita_luogo) ? p.nascita_luogo + (pieno(p.nascita_prov) ? ` (${p.nascita_prov})` : "") : RIGA;
    // "ad Ancona", "ad Arezzo": la d eufonica davanti alla a
    return `${femmina(p) ? "nata" : "nato"} ${/^[aàAÀ]/.test(luogo) ? "ad" : "a"} ${luogo} il ${data(p.nascita_data)}`;
  };

  /** L'articolo davanti alla persona: "il sig.", "la sig.ra", "la Soc.";
   *  con "dativo", "al sig.", "alla sig.ra", "alla Soc.". */
  function articolo(p, dativo) {
    if (p.tipo === "giuridica") return dativo ? "alla Soc. " : "la Soc. ";
    return femmina(p) ? (dativo ? "alla sig.ra " : "la sig.ra ") : (dativo ? "al sig. " : "il sig. ");
  }

  /** Una persona fisica o una societa', come si scrive nel contratto. */
  function persona(p, ruolo, dativo = false, inElenco = false) {
    // in un elenco (dopo "I sigg.ri:") ogni riga comincia con il nome
    const testa = inElenco ? (p.tipo === "giuridica" ? "Soc. " : "") : articolo(p, dativo);
    if (p.tipo === "giuridica") {
      const r = Object.assign({}, p.rappresentante || {}, { tipo: "fisica" });
      return [P(testa), ...nome(p), ...cf(p.cf),
        P((pieno(p.partita_iva) ? `, P.IVA ${p.partita_iva.trim()}` : "") + `, con sede in ${o(p.sede)}, rappresentata da${femmina(r) ? "lla sig.ra" : "l sig."} `),
        ...nome(r), ...cf(r.cf), P(`, ${nascita(r)}, in qualità di ${o(r.qualita, "amministratore")}`)];
    }
    const parti = [...(testa ? [P(testa)] : []), ...nome(p), ...cf(p.cf)];
    if (ruolo === "studente") {
      parti.push(P((pieno(p.matricola) ? `, matr. ${p.matricola.trim()}` : "") + `, ${nascita(p)}, residente in ${o(p.residenza)}`));
      const d = p.documento || {};
      parti.push(P(`, ${femmina(p) ? "identificata" : "identificato"} mediante ${o(d.tipo, "C.I.")} n. ${o(d.numero)}` +
                   ` del ${data(d.data)} rilasciata da ${o(d.rilasciato_da)}`));
    } else if (ruolo === "conduttore") {
      const d = p.documento || {};
      parti.push(P(`, ${nascita(p)}, ${femmina(p) ? "domiciliata" : "domiciliato"} nei locali oggetto della locazione` +
                   `, ${femmina(p) ? "identificata" : "identificato"} mediante ${o(d.tipo, "C.I.")} n. ${o(d.numero)}` +
                   ` rilasciata da ${o(d.rilasciato_da)} il ${data(d.data)}`));
    } else {
      parti.push(P(`, ${nascita(p)}, residente in ${o(p.residenza)}`));
    }
    return parti;
  }

  const plurale = (lista) => lista.length > 1;
  const tutteFemmine = (lista) => lista.length && lista.every((p) => p.tipo !== "giuridica" && femmina(p));
  /** assistito, assistita, assistiti, assistite */
  const accorda = (lista, radice) => radice + (plurale(lista) ? (tutteFemmine(lista) ? "e" : "i")
    : (lista[0] && (lista[0].tipo === "giuridica" || femmina(lista[0])) ? "a" : "o"));

  /** L'elenco delle parti: una sola in linea, con la maiuscola; piu' d'una
   *  con un trattino ciascuna (ognuna con il suo "il sig.", "la sig.ra"). */
  function elencoParti(lista, ruolo, dativo = false) {
    if (!lista.length) lista = [{}];
    if (lista.length === 1) {
      const parti = persona(lista[0], ruolo, dativo);
      parti[0] = P(parti[0].testo.charAt(0).toUpperCase() + parti[0].testo.slice(1), parti[0].g);
      return [{ parti }];
    }
    const donne = lista.every((p) => p.tipo !== "giuridica" && femmina(p));
    const testa = dativo ? (donne ? "Alle sig.re:" : "Ai sigg.ri:") : (donne ? "Le sig.re:" : "I sigg.ri:");
    return [{ parti: [P(testa)] },
            ...lista.map((p) => ({ parti: [P("- "), ...persona(p, ruolo, dativo, true), P(";")], rientro: 1 }))];
  }

  // ------------------------------------------------------------ immobile

  function immobile(i) {
    const indirizzo = `${pieno(i.comune) ? i.comune.trim() : "________"}, ${o(i.via)}, n. ${o(i.civico, "____")}` +
      (pieno(i.piano) ? `, piano ${i.piano}` : "") + (pieno(i.scala) ? `, scala ${i.scala}` : "") +
      (pieno(i.interno) ? `, int. ${i.interno}` : "");
    let t = (i.porzione ? "una porzione dell'unità immobiliare posta in " : "l'unità immobiliare posta in ") + indirizzo +
      `, composta di n. ${o(i.vani, "____")} vani, oltre cucina e servizi` + (pieno(i.descrizione) ? `, ${i.descrizione.trim()}` : "");
    const accessori = (i.accessori || []).filter(pieno);
    if (accessori.length) t += `, e dotata altresì dei seguenti elementi accessori: ${elenco(accessori)}`;
    if (i.porzione) t += `, il cui utilizzo è regolato nel seguente modo: ${o(i.regolazione)}`;
    t += i.ammobiliato === "si" ? ", ammobiliata come da elenco a parte sottoscritto dalle parti."
       : i.ammobiliato === "parzialmente" ? ", parzialmente ammobiliata come da elenco a parte sottoscritto dalle parti."
       : ", non ammobiliata.";
    return t;
  }

  /** Le unita' catastali: una sola in linea, piu' d'una in elenco puntato;
   *  foglio, particella, subalterno e categoria in grassetto. */
  function unitaCatastali(i) {
    const unita = (i.catasto || []).filter((u) => Object.values(u).some(pieno));
    if (!unita.length) unita.push({});
    return unita.map((u) => [
      P(pieno(u.descrizione) ? `${u.descrizione.trim()}: ` : ""),
      P(`foglio ${o(u.foglio, "____")} particella ${o(u.particella, "____")} sub ${o(u.sub, "____")}`, true),
      P(", cat. catastale "), P(o(u.categoria, "____"), true),
      P(`, classe ${o(u.classe, "____")}, ${pieno(u.consistenza) ? "consistenza " + u.consistenza : "vani ____"}` +
        `, rendita catastale € ${pieno(u.rendita) ? Lettere.cifre(u.rendita) : "________"}`),
    ]);
  }

  /** Un testo con alcune parti in grassetto: ["testo", ["grassetto"], "testo"]. */
  const G = (...pezzi) => pezzi.filter((x) => x !== "" && x !== null && x !== undefined)
    .map((x) => (Array.isArray(x) ? P(String(x[0]), true) : P(String(x))));

  /** La durata in mesi (anche frazionari); Infinity se non ha una fine. */
  function durataMesi(d) {
    if (d.tipo === "transitorio" || d.tipo === "turistico") return (Number(d.durata_numero) || 0) + (Number(d.durata_giorni) || 0) / 30;
    if (d.tipo === "comodato") {
      if (d.durata_comodato !== "determinata") return Infinity;
      const a = String(d.decorrenza || ""), z = String(d.scadenza || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(z)) return Infinity;
      // dai due mesi: la fine e' almeno il giorno prima dell'anniversario di due mesi
      return z >= scadenza(a, 0, 2) ? 2 : 1;
    }
    return Infinity;
  }

  /** Il recesso del conduttore (o la restituzione anticipata) c'e' sempre nei
   *  contratti di almeno due mesi; in quelli piu' brevi solo se richiesto. */
  const breveSenzaObbligo = (d) => durataMesi(d) < 2;
  const conRecesso = (d) => !breveSenzaObbligo(d) || !!d.recesso_breve;

  /** Il preavviso per il recesso del conduttore, in lettere: "sei mesi", "un mese". */
  function preavviso(d, predefinito) {
    const m = Number(d.preavviso_mesi);
    if (!m && pieno(d.preavviso)) return d.preavviso.trim();          // contratti salvati prima
    if (m === 0.5) return "quindici giorni";
    const n = m || predefinito;
    return n === 1 ? "un mese" : `${Lettere.intero(n)} mesi`;
  }

  /** I fideiussori e la loro garanzia (annuale o per l'intera durata). */
  function fideiussori(par, d, fid) {
    if (!fid.length) return;
    par("Ad ulteriore garanzia intervengono alla firma del presente contratto in qualità di fideiussore della parte conduttrice:");
    fid.forEach((f) => par([P("- "), ...persona(f, "fideiussore", false, true), P(";")], { rientro: 1 }));
    const tutti = fid.length > 1, f0 = femmina(fid[0]);
    par(G(`${tutti ? "i quali dichiarano" : f0 ? "la quale dichiara" : "il quale dichiara"} espressamente di rendersi ${tutti ? "coobbligati" : f0 ? "coobbligata" : "coobbligato"} con la parte conduttrice sino alla concorrenza della somma di `,
          [euro(d.fideiussione_importo)], d.fideiussione_periodo === "intera" ? " per l'intera durata della locazione" : " per ciascuna annualità del contratto",
          " e al rispetto di tutte le clausole del contratto stesso ed in particolare per il pagamento dei canoni di locazione rinunciando espressamente, in caso di inadempimento da parte dell'obbligato principale, al beneficio della di lui previa escussione."));
  }

  /** ", pari a 2 mensilità del canone" se le mensilità sono intere; una riga
   *  da compilare se mancano; niente se non sono intere (0,33 mensilità). */
  function mensilita(dep, n = "") {
    if (!pieno(dep.mensilita)) return `, pari a ${n}____ mensilità del canone`;
    const v = Number(String(dep.mensilita).replace(",", "."));
    if (!Number.isFinite(v) || !Number.isInteger(v) || v <= 0) return "";
    return `, pari a ${n}${v} ${v === 1 ? "mensilità" : "mensilità"} del canone`;
  }

  /** Locatori, conduttori, immobile: uguali per tutti i tipi di contratto. */
  function partiEImmobile(B, d, imp, opz) {
    const loc = d.locatori || [], con = d.conduttori || [], i = d.immobile || {};
    const par = (testo, extra = {}) => B.push(Object.assign({ t: "par", parti: Array.isArray(testo) ? testo : [P(testo)] }, extra));
    const ruoloCon = opz.ruoloConduttore || "conduttore";
    elencoParti(loc, "locatore").forEach((b) => par(b.parti, { rientro: b.rientro }));
    par(`di seguito ${plurale(loc) ? accorda(loc, "denominat") + ", congiuntamente," : accorda(loc, "denominat")} locatore` +
        (assistenzaLocatore(d) ? ` (${accorda(loc, "assistit")} da ${assistenzaLocatore(d)})` : ""));
    B.push({ t: "centro", testo: plurale(loc) ? "CONCEDONO IN LOCAZIONE" : "CONCEDE IN LOCAZIONE", g: true, s: 12 });

    // conduttore
    elencoParti(con, ruoloCon, true).forEach((b) => par(b.parti, { rientro: b.rientro }));
    const assCon = d.assistenza_conduttore || {};
    par(`di seguito ${plurale(con) ? `${accorda(con, "denominat")}, congiuntamente, conduttore, ${accorda(con, "obbligat")} in solido tra loro` : accorda(con, "denominat") + " conduttore"}` +
        (pieno(assCon.organizzazione) ? ` (${accorda(con, "assistit")} da ${assCon.organizzazione}${pieno(assCon.persona) ? " in persona di " + assCon.persona : ""})` : "") + ",");
    B.push({ t: "centro", testo: opz.accetta ? opz.accetta(plurale(con)) : plurale(con) ? "CHE ACCETTANO, PER SÉ E LORO AVENTI CAUSA," : "CHE ACCETTA, PER SÉ E SUOI AVENTI CAUSA,", g: true, s: 12 });

    // immobile
    par(immobile(i));
    const unita = unitaCatastali(i);
    if (unita.length === 1) par([P("A) ESTREMI CATASTALI identificativi dell'unità immobiliare: "), ...unita[0], P(".")], { rientro: 1 });
    else {
      par("A) ESTREMI CATASTALI identificativi delle unità immobiliari:", { rientro: 1 });
      unita.forEach((u, k) => par([P("- "), ...u, P(k < unita.length - 1 ? ";" : ".")], { rientro: 2 }));
    }
    par(`B) PRESTAZIONE ENERGETICA: Classe ${o(i.classe_energetica, "____")}. Il conduttore dichiara di aver ricevuto le informazioni e la documentazione in ordine alla attestazione della prestazione energetica dell'immobile.`, { rientro: 1 });
    par(`C) SICUREZZA IMPIANTI: Il conduttore prende atto che gli impianti esistenti nell'appartamento in oggetto e quelli condominiali ${i.impianti_a_norma === false ? "non dispongono" : "dispongono"} di certificazione a norma, ai sensi delle disposizioni vigenti in materia di sicurezza.`, { rientro: 1 });
    const mm = i.millesimi || {};
    const tabelle = [["proprietà", mm.proprieta], ["riscaldamento", mm.riscaldamento], ["acqua", mm.acqua], ["scale", mm.scale], ["ascensore", mm.ascensore], ["altre", mm.altre]].filter(([, v]) => pieno(v));
    if (tabelle.length) par(`D) TABELLE MILLESIMALI: ${tabelle.map(([k, v]) => `${k} ${v}`).join(", ")}.`, { rientro: 1 });
  }

  // ------------------------------------------------------------ il contratto 3+2

  function agevolato(d, a, imp) {
    const acc = a.accordo, B = [];
    const loc = d.locatori || [], con = d.conduttori || [], fid = (d.fideiussori || []).filter((f) => pieno(f.cf) || pieno(f.cognome));
    const i = d.immobile || {};
    // la cedolare secca e' solo per i locatori persone fisiche
    const cedolare = d.cedolare !== false && !loc.some((p) => p.tipo === "giuridica");
    const scadenzaRata = termineRata(d);
    const par = (testo, extra = {}) => B.push(Object.assign({ t: "par", parti: Array.isArray(testo) ? testo : [P(testo)] }, extra));
    const titolo = (testo) => B.push({ t: "titolo", testo });

    B.push({ t: "intestazione", righe: [
      { testo: "CONTRATTO DI LOCAZIONE AD USO ABITATIVO", g: true, s: 14, sottolinea: true },
      { testo: "Ai sensi dell'art.2 – Comma 3 legge 9/12/98 n° 431", s: 12 },
      { testo: "concordato tra le Organizzazioni della proprietà e degli inquilini", s: 11 },
      { testo: `Depositato presso il Comune di ${comuneAccordo(acc)} il ${acc.deposito_data}`, s: 11 },
      { testo: `Con protocollo n° ${acc.protocollo} ${acc.ufficio_breve}`, s: 11 },
    ] });
    B.push({ t: "centro", testo: "A TASSAZIONE AGEVOLATA AI SENSI DELL'ART. 8 COMMA 1 LEGGE 431/98", s: 11 });

    partiEImmobile(B, d, imp, { ruoloConduttore: "conduttore" });
    B.push({ t: "centro", testo: "LA LOCAZIONE È REGOLATA DALLE PATTUIZIONI SEGUENTI.", s: 12 });

    // Articolo 1
    const anni = Number(d.durata_anni) || 3;
    titolo("Articolo 1 (Durata)");
    par(G("Il contratto è stipulato per la durata di ", [`${anni} anni`], ", dal ", [data(d.decorrenza)], " al ", [data(d.scadenza)], ` e alla prima scadenza, ove le parti non concordino sul rinnovo del medesimo, il contratto è prorogato di diritto di due anni, fatta salva la facoltà di disdetta da parte del locatore che intenda adibire l'immobile agli usi o effettuare sullo stesso le opere di cui all'articolo 3 della legge n. 431/98, ovvero vendere l'immobile alle condizioni e con le modalità di cui al citato articolo 3. Alla scadenza del periodo di proroga biennale ciascuna parte ha diritto di attivare la procedura per il rinnovo a nuove condizioni ovvero per la rinuncia al rinnovo del contratto, comunicando la propria intenzione con lettera raccomandata da inviare all'altra parte almeno sei mesi prima della scadenza. In mancanza della comunicazione, il contratto è rinnovato tacitamente alle stesse condizioni. Nel caso in cui il locatore abbia riacquistato la disponibilità dell'alloggio alla prima scadenza e non lo adibisca, nel termine di dodici mesi dalla data in cui ha riacquistato tale disponibilità, agli usi per i quali ha esercitato la facoltà di disdetta, il conduttore ha diritto al ripristino del rapporto di locazione alle stesse condizioni di cui al contratto disdettato o, in alternativa, ad un risarcimento pari a trentasei mensilità dell'ultimo canone di locazione corrisposto.`));

    // Articolo 2
    const annuo = Number(d.canone_annuo) || 0, rate = Number(d.rate) || 12;
    const modi = { bonifico: "a mezzo di bonifico bancario" + (pieno(d.iban) ? ` sul conto IBAN ${d.iban.replace(/\s+/g, "").toUpperCase()}` + (pieno(d.intestatario_conto) ? ` intestato a ${d.intestatario_conto}` : "") : ""),
                   domicilio: "nel domicilio del locatore", altro: o(d.pagamento_altro) };
    titolo("Articolo 2 (Canone)");
    par(G(`Il canone annuo di locazione, secondo quanto stabilito dall'Accordo territoriale definito tra le Organizzazioni della Proprietà e le Organizzazioni degli inquilini e depositato il ${acc.deposito_data} con Protocollo n. ${acc.protocollo} presso il Comune di ${comuneAccordo(acc)}${acc.ufficio ? " / " + acc.ufficio : ""}, è convenuto in `, [euro(annuo) + " annuali"], `, che il conduttore si obbliga a corrispondere ${modi[d.pagamento] || modi.bonifico}, in n. ${rate} rate eguali anticipate di ${euro(annuo ? annuo / rate : null)} ciascuna, ${scadenzaRata}.`));
    if (cedolare) {
      par("Nel caso in cui l'Accordo territoriale di cui al presente punto lo preveda, il canone viene aggiornato ogni anno nella misura contrattata del 75%, che comunque non può superare il 75% della variazione Istat, ed esclusivamente nel caso in cui il locatore non abbia optato per la \u201ccedolare secca\u201d, per la durata dell'opzione.");
    } else {
      par(`Nel caso in cui l'Accordo territoriale di cui al presente punto lo preveda, il canone viene aggiornato ogni anno nella misura contrattata del ${o(d.istat, "75%")} (che comunque non può superare il 75% della variazione Istat).`);
    }

    // Articolo 3
    titolo("Articolo 3 (Deposito cauzionale e altre forme di garanzia)");
    const dep = d.deposito || {}, mens = pieno(dep.mensilita) ? `${dep.mensilita}` : "____";
    const coda = " non imputabile in conto canoni e produttiva di interessi legali, riconosciuti al conduttore al termine di ogni anno di locazione, salvo che la durata contrattuale minima non sia, ferma la proroga del contratto per due anni, di almeno 5 anni o superiore. Il deposito cauzionale così costituito viene reso al termine della locazione, previa verifica sia dello stato dell'unità immobiliare sia dell'osservanza di ogni obbligazione contrattuale.";
    if (dep.modo === "nessuno") {
      par("A garanzia delle obbligazioni assunte col presente contratto, il conduttore non versa al locatore alcuna somma a titolo di deposito cauzionale.");
    } else if (dep.modo === "precedente") {
      par(`A garanzia delle obbligazioni assunte col presente contratto, il conduttore ha già versato al locatore, con il precedente contratto di locazione, una somma di ${euro(dep.importo)}${mensilita(dep)}, che resta a titolo di deposito cauzionale per il presente contratto,` + coda);
    } else {
      par(`A garanzia delle obbligazioni assunte col presente contratto, il conduttore versa al locatore (che con la firma del contratto ne rilascia quietanza) una somma di ${euro(dep.importo)}${mensilita(dep)},` + coda);
    }
    if (pieno(d.altre_garanzie)) par(`Eventuali altre forme di garanzia: ${d.altre_garanzie.trim()}`);
    fideiussori(par, d, fid);

    // Articolo 4
    titolo("Articolo 4 (Oneri accessori)");
    par("Per gli oneri accessori le parti fanno applicazione della Tabella oneri accessori, allegato D al decreto emanato dal Ministro delle infrastrutture e dei trasporti di concerto con il Ministro dell'economia e delle finanze ai sensi dell'articolo 4, comma 2, della legge n. 431/1998 e di cui il presente contratto costituisce l'allegato A.");
    par("In sede di consuntivo, il pagamento degli oneri anzidetti, per la quota parte di quelli condominiali/comuni a carico del conduttore, deve avvenire entro sessanta giorni dalla richiesta. Prima di effettuare il pagamento, il conduttore ha diritto di ottenere l'indicazione specifica delle spese anzidette e dei criteri di ripartizione. Ha inoltre diritto di prendere visione - anche tramite organizzazioni sindacali - presso il locatore (o il suo amministratore o l'amministratore condominiale, ove esistente) dei documenti giustificativi delle spese effettuate. Insieme con il pagamento della prima rata del canone annuale, il conduttore versa una quota di acconto non superiore a quella di sua spettanza risultante dal rendiconto dell'anno precedente." +
        (pieno(d.oneri_acconto) && Number(d.oneri_acconto) ? ` Per le spese di cui al presente articolo il conduttore versa una quota di € ${Lettere.cifre(d.oneri_acconto)} ${pieno(d.oneri_periodo) ? d.oneri_periodo + " " : ""}salvo conguaglio.` : ""));

    // Articolo 5
    titolo("Articolo 5 (Spese di bollo e di registrazione)");
    if (cedolare) {
      par("Il locatore intende avvalersi delle disposizioni di cui al D.Lgs. n. 23 del 14-03-2011, cosiddetta \u201ccedolare secca\u201d. Pertanto, a norma di tale disposizione, il locatore dichiara di rinunciare all'applicazione degli adeguamenti Istat. Il presente contratto, quindi, è esente da imposta di bollo e tassa di registro. È facoltà del locatore recedere dalla tassazione della cedolare secca e in tal caso il canone sarà adeguato annualmente con l'applicazione dell'Istat al 75% e le spese di bollo per il presente contratto e per le ricevute conseguenti sono a carico del conduttore, mentre la tassa di registro è pari alla metà. Il locatore provvede alla registrazione del contratto, dandone documentata comunicazione al conduttore e all'Amministratore del condominio ai sensi dell'art. 13 legge 431 del 1998. Le parti possono delegare alla registrazione del contratto una delle organizzazioni sindacali che abbia prestato assistenza ai fini della stipula del contratto medesimo.");
    } else {
      par("Le spese di bollo per il presente contratto e per le ricevute conseguenti sono a carico del conduttore. Il locatore provvede alla registrazione del contratto, dandone documentata comunicazione al conduttore - che corrisponde la quota di sua spettanza, pari alla metà - e all'Amministratore del condominio ai sensi dell'art. 13 legge 431 del 1998. Le parti possono delegare alla registrazione del contratto una delle organizzazioni sindacali che abbia prestato assistenza ai fini della stipula del contratto medesimo.");
    }

    titolo("Articolo 6 (Pagamento)");
    par("Il pagamento del canone o di quant'altro dovuto anche per oneri accessori non può venire sospeso o ritardato da pretese o eccezioni del conduttore, quale ne sia il titolo. Il mancato puntuale pagamento, per qualsiasi causa, anche di una sola rata del canone, nonché di quant'altro dovuto, ove di importo pari almeno ad una mensilità del canone, costituisce in mora il conduttore, fatto salvo quanto previsto dall'articolo 55 della legge 27 luglio 1978, n. 392.");

    titolo("Articolo 7 (Uso)");
    par("L'immobile deve essere destinato esclusivamente a civile abitazione del conduttore" +
        (pieno(d.conviventi) ? ` e delle seguenti persone attualmente con lui conviventi: ${d.conviventi.trim()}.` : ".") +
        (d.sublocazione ? " Viene consentita al conduttore la sublocazione e il comodato sia totale sia parziale." : " Salvo espresso patto scritto contrario, è fatto divieto di sublocazione e di comodato sia totale sia parziale.") +
        " Per la successione nel contratto si applica l'articolo 6 della legge n. 392/78, nel testo vigente a seguito della sentenza della Corte costituzionale n. 404/1988.");

    titolo("Articolo 8 (Recesso del conduttore)");
    par(`È facoltà del conduttore recedere dal contratto per gravi motivi, previo avviso da recapitarsi tramite lettera raccomandata almeno ${preavviso(d, 6)} prima.`);

    titolo("Articolo 9 (Consegna)");
    par("Il conduttore dichiara di aver visitato l'unità immobiliare locatagli, di averla trovata adatta all'uso convenuto e, pertanto, di prenderla in consegna ad ogni effetto col ritiro delle chiavi, costituendosi da quel momento custode della stessa. Il conduttore si impegna a riconsegnare l'unità immobiliare nello stato in cui l'ha ricevuta, salvo il deperimento d'uso, pena il risarcimento del danno; si impegna, altresì, a rispettare le norme del regolamento dello stabile ove esistente, accusando in tal caso ricevuta dello stesso con la firma del presente contratto, così come si impegna ad osservare le deliberazioni dell'assemblea dei condomini. È in ogni caso vietato al conduttore compiere atti e tenere comportamenti che possano recare molestia agli altri abitanti dello stabile. Le parti danno atto, in relazione allo stato dell'unità immobiliare, ai sensi dell'articolo 1590 del Codice civile, " +
        (pieno(d.stato_immobile) ? `di quanto segue: ${d.stato_immobile.trim()}${/[.]$/.test(d.stato_immobile.trim()) ? "" : "."}` : `di quanto segue: ${RIGA}${RIGA}${RIGA} ovvero di quanto risulta dall'allegato verbale di consegna.`));

    titolo("Articolo 10 (Modifiche e danni)");
    par("Il conduttore non può apportare alcuna modifica, innovazione, miglioria o addizione ai locali locati ed alla loro destinazione, o agli impianti esistenti, senza il preventivo consenso scritto del locatore. Il conduttore esonera espressamente il locatore da ogni responsabilità per danni diretti o indiretti che possano derivargli da fatti dei dipendenti del locatore medesimo nonché per interruzioni incolpevoli dei servizi.");

    titolo("Articolo 11 (Assemblee)");
    par("Il conduttore ha diritto di voto, in luogo del proprietario dell'unità immobiliare locatagli, nelle deliberazioni dell'assemblea condominiale relative alle spese ed alle modalità di gestione dei servizi di riscaldamento e di condizionamento d'aria. Ha inoltre diritto di intervenire, senza voto, sulle deliberazioni relative alla modificazione degli altri servizi comuni. Quanto stabilito in materia di riscaldamento e di condizionamento d'aria si applica anche ove si tratti di edificio non in condominio. In tale caso (e con l'osservanza, in quanto applicabili, delle disposizioni del codice civile sull'assemblea dei condomini) i conduttori si riuniscono in apposita assemblea, convocata dalla proprietà o da almeno tre conduttori.");

    titolo("Articolo 12 (Impianti)");
    par("Il conduttore - in caso d'installazione sullo stabile di antenna televisiva centralizzata - si obbliga a servirsi unicamente dell'impianto relativo, restando sin d'ora il locatore, in caso di inosservanza, autorizzato a far rimuovere e demolire ogni antenna individuale a spese del conduttore, il quale nulla può pretendere a qualsiasi titolo, fatte salve le eccezioni di legge. Per quanto attiene all'impianto termico autonomo, ove presente, ai sensi della normativa del d.lgs n. 192/05, con particolare riferimento all'art. 7 comma 1, il conduttore subentra per la durata della detenzione alla figura del proprietario nell'onere di adempiere alle operazioni di controllo e di manutenzione.");

    titolo("Articolo 13 (Accesso)");
    par("Il conduttore deve consentire l'accesso all'unità immobiliare al locatore, al suo amministratore nonché ai loro incaricati ove gli stessi ne abbiano - motivandola - ragione.");
    par("Nel caso in cui il locatore intenda vendere o, in caso di recesso anticipato del conduttore, locare l'unità immobiliare, questi deve consentirne la visita una volta la settimana, per almeno due ore, con esclusione dei giorni festivi" +
        (pieno(d.visite) ? ` oppure con le seguenti modalità: ${d.visite.trim()}${/[.]$/.test(d.visite.trim()) ? "" : "."}` : "."));

    titolo("Articolo 14 (Commissione di negoziazione paritetica e conciliazione stragiudiziale)");
    par("La Commissione di cui all'articolo 6 del decreto del Ministro delle infrastrutture e dei trasporti di concerto con il Ministro dell'economia e delle finanze, emanato ai sensi dell'articolo 4, comma 2, della legge 431 del 1998, è composta da due membri scelti fra appartenenti alle rispettive organizzazioni firmatarie dell'Accordo territoriale sulla base delle designazioni, rispettivamente, del locatore e del conduttore.");
    par("L'operato della Commissione è disciplinato dal documento \u201cProcedure di negoziazione e conciliazione stragiudiziale nonché modalità di funzionamento della Commissione\u201d, Allegato E al citato decreto. La richiesta di intervento della Commissione non determina la sospensione delle obbligazioni contrattuali.");
    par("La richiesta di attivazione della Commissione non comporta oneri.");

    titolo("Articolo 15 (Varie)");
    par("A tutti gli effetti del presente contratto, compresa la notifica degli atti esecutivi, e ai fini della competenza a giudicare, il conduttore elegge domicilio nei locali a lui locati e, ove egli più non li occupi o comunque detenga, presso l'ufficio di segreteria del Comune ove è situato l'immobile locato.");
    par("Qualunque modifica al presente contratto non può aver luogo, e non può essere provata, se non con atto scritto. Il locatore ed il conduttore si autorizzano reciprocamente a comunicare a terzi i propri dati personali in relazione ad adempimenti connessi col rapporto di locazione (d.Lgs n. 196/03). Per quanto non previsto dal presente contratto le parti rinviano a quanto in materia disposto dal Codice civile, dalle leggi n. 392/1978 e n. 431 del 1998 o comunque dalle norme vigenti e dagli usi locali nonché alla normativa ministeriale emanata in applicazione della legge n. 431 del 1998 ed all'Accordo definito in sede locale.");
    if (pieno(d.altre_clausole)) {
      titolo("Altre clausole");
      String(d.altre_clausole).trim().split(/\n\s*\n|\n/).filter(pieno).forEach((r) => par(r.trim()));
    }

    // firme
    firme(B, d, loc, con, fid);
    return B;
  }

  // ------------------------------------------------------------ studenti universitari

  function studenti(d, a, imp) {
    const acc = a.accordo, B = [];
    const loc = d.locatori || [], con = d.conduttori || [], fid = (d.fideiussori || []).filter((f) => pieno(f.cf) || pieno(f.cognome));
    const par = (testo, extra = {}) => B.push(Object.assign({ t: "par", parti: Array.isArray(testo) ? testo : [P(testo)] }, extra));
    const titolo = (testo) => B.push({ t: "titolo", testo });
    const cedolare = d.cedolare !== false && !loc.some((p) => p.tipo === "giuridica");
    const accordoDi = `depositato il ${acc.deposito_data} con Protocollo n° ${acc.protocollo} presso il Comune di ${comuneAccordo(acc)}`;

    B.push({ t: "intestazione", righe: [
      { testo: "LOCAZIONE ABITATIVA PER STUDENTI UNIVERSITARI", g: true, s: 12.5, sottolinea: true },
      { testo: "(Legge 9 dicembre 1998, n. 431, articolo 5, comma 2)", s: 10.5 },
      { testo: "Concordato tra le Organizzazioni della proprietà", s: 10 },
      { testo: "e le Organizzazioni degli inquilini", s: 10 },
      { testo: `Depositato presso il Comune di ${comuneAccordo(acc)} il ${acc.deposito_data}, n° Prot. ${acc.protocollo}`, s: 10 },
      { testo: `quale allegato dell'accordo sottoscritto il ${acc.data_testo}`, s: 10 },
      { testo: "(a tassazione agevolata ai sensi dell'art. 8 comma 1 L. 431/98)", s: 10 },
    ] });
    partiEImmobile(B, d, imp, { ruoloConduttore: "studente",
      accetta: (piu) => piu ? "CHE ACCETTANO PER SÉ E AVENTI CAUSA," : "CHE ACCETTA PER SÉ E AVENTI CAUSA," });
    B.push({ t: "centro", testo: "LA LOCAZIONE È REGOLATA DALLE PATTUIZIONI SEGUENTI.", s: 12 });

    const mesi = Number(d.durata_mesi) || 12;
    titolo("Articolo 1 (Durata)");
    par(G("Il contratto è stipulato per la durata di ", [`${mesi} mesi`], ", dal ", [data(d.decorrenza)], " al ", [data(d.scadenza)], "."));
    par("Alla prima scadenza il contratto si rinnova automaticamente per uguale periodo se il conduttore non comunica al locatore disdetta almeno un mese e non oltre tre mesi prima della data di scadenza del contratto.");

    titolo("Articolo 2 (Natura transitoria)");
    par(`Secondo quanto previsto dall'Accordo territoriale stipulato ai sensi dell'articolo 5, comma 3, della legge n. 431/98, tra le Organizzazioni della proprietà e le Organizzazioni degli inquilini, ${accordoDi}, le parti concordano che la presente locazione ha natura transitoria in quanto il conduttore espressamente ha l'esigenza di abitare l'immobile frequentando il corso di studi di ${o(d.corso_studi)} presso ${o(d.universita)}.`);

    const annuo = Number(d.canone_annuo) || 0, rate = Number(d.rate) || 12;
    const modi = { bonifico: "a mezzo di bonifico bancario" + (pieno(d.iban) ? ` sul conto IBAN ${d.iban.replace(/\s+/g, "").toUpperCase()}` + (pieno(d.intestatario_conto) ? ` intestato a ${d.intestatario_conto}` : "") : ""),
                   domicilio: "nel domicilio del locatore", altro: o(d.pagamento_altro) };
    titolo("Articolo 3 (Canone)");
    par(G(`Il canone annuo di locazione, secondo quanto stabilito dall'Accordo territoriale definito tra le Organizzazioni della proprietà e le Organizzazioni degli inquilini, ${accordoDi}, è convenuto in `, [euro(annuo)], `, che il conduttore si obbliga a corrispondere ${modi[d.pagamento] || modi.bonifico}, in n. ${rate} rate eguali anticipate di ${euro(annuo ? annuo / rate : null)} ciascuna, ${termineRata(d)}.`));
    if (!cedolare) par(`Nel caso in cui l'Accordo territoriale lo preveda, il canone viene aggiornato ogni anno nella misura contrattata del ${o(d.istat, "75%")} (che comunque non può superare il 75% della variazione Istat).`);

    titolo("Articolo 4 (Deposito cauzionale e altre forme di garanzia)");
    const dep = d.deposito || {}, mens = pieno(dep.mensilita) ? `${dep.mensilita}` : "____";
    const coda = " non imputabile in conto canoni e produttiva di interessi legali, riconosciuti al conduttore al termine della locazione. Il deposito cauzionale così costituito viene reso al termine della locazione previa verifica dello stato dell'unità immobiliare e dell'osservanza di ogni obbligazione contrattuale.";
    if (dep.modo === "nessuno") par("A garanzia delle obbligazioni assunte col presente contratto, il conduttore non versa al locatore alcuna somma a titolo di deposito cauzionale.");
    else if (dep.modo === "precedente") par(`A garanzia delle obbligazioni assunte col presente contratto, il conduttore ha già versato al locatore, con il precedente contratto di locazione, una somma di ${euro(dep.importo)}${mensilita(dep, "n. ")}, che resta a titolo di deposito cauzionale per il presente contratto,` + coda);
    else par(`A garanzia delle obbligazioni assunte col presente contratto, il conduttore versa al locatore (che con la firma del contratto ne rilascia quietanza) una somma di ${euro(dep.importo)}${mensilita(dep, "n. ")},` + coda);
    if (pieno(d.altre_garanzie)) par(`Eventuali altre forme di garanzia: ${d.altre_garanzie.trim()}`);
    fideiussori(par, d, fid);

    titolo("Articolo 5 (Oneri accessori)");
    par("Per gli oneri accessori le parti fanno applicazione della Tabella oneri accessori, allegato D al decreto emanato dal Ministro delle infrastrutture e dei trasporti di concerto con il Ministro dell'economia e delle finanze ai sensi dell'articolo 4, comma 2, della legge n. 431/1998 e di cui il presente contratto costituisce l'Allegato C.");
    const oneriAlLocatore = d.oneri_modo === "locatore";
    par("In sede di consuntivo, il pagamento degli oneri anzidetti, per la quota parte di quelli condominiali/comuni a carico del conduttore, deve avvenire entro sessanta giorni dalla richiesta. Prima di effettuare il pagamento, il conduttore ha diritto di ottenere l'indicazione specifica delle spese anzidette e dei criteri di ripartizione. Ha inoltre diritto di prendere visione - anche tramite organizzazioni sindacali - presso il locatore (o il suo amministratore o l'amministratore condominiale, ove esistente) dei documenti giustificativi delle spese effettuate. Insieme con il pagamento della prima rata del canone annuale, il conduttore versa una quota di acconto non superiore a quella di sua spettanza risultante dal rendiconto dell'anno precedente " +
      (oneriAlLocatore ? `direttamente al locatore, mensilmente unitamente al canone di locazione, che ammonta ad € ${pieno(d.oneri_acconto) && Number(d.oneri_acconto) ? Lettere.cifre(d.oneri_acconto) : RIGA}` + (pieno(d.oneri_quota) ? `, corrispondente al ${d.oneri_quota.trim()} del totale.` : ".")
        : "direttamente all'amministratore dello stabile."));
    par("Sono inoltre interamente a carico del conduttore le spese relative ad ogni utenza (energia elettrica, acqua, gas, telefono, nettezza urbana e quant'altro come per legge)." +
        (pieno(d.utenze_acconto) && Number(d.utenze_acconto) ? ` Per tali spese, il conduttore versa una quota di € ${Lettere.cifre(d.utenze_acconto)} salvo conguaglio.` : ""));

    titolo("Articolo 6 (Spese di bollo e di registrazione)");
    if (cedolare) {
      par("Il locatore intende avvalersi delle disposizioni di cui al D.Lgs. n. 23 del 14-03-2011, cosiddetta \u201ccedolare secca\u201d. Pertanto, a norma di tale disposizione, il locatore dichiara di rinunciare all'applicazione degli adeguamenti Istat. Il presente contratto, quindi, è esente da imposta di bollo e tassa di registro. È facoltà del locatore recedere dalla tassazione della cedolare secca e in tal caso il canone sarà adeguato annualmente con l'applicazione dell'Istat al 75%.");
    } else {
      par("Le spese di bollo per il presente contratto e per le ricevute conseguenti sono a carico del conduttore. Il locatore provvede alla registrazione del contratto, dandone documentata comunicazione al conduttore - che corrisponde la quota di sua spettanza, pari alla metà - e all'Amministratore del condominio ai sensi dell'art. 13 legge 431 del 1998.");
    }
    par("Le parti possono delegare alla registrazione del contratto una delle organizzazioni sindacali che abbia prestato assistenza ai fini della stipula del contratto medesimo.");

    titolo("Articolo 7 (Pagamento)");
    par("Il pagamento del canone o di quant'altro dovuto anche per oneri accessori non può venire sospeso o ritardato da pretese o eccezioni del conduttore, quale ne sia il titolo. Il mancato puntuale pagamento, per qualsiasi causa, anche di una sola rata del canone (nonché di quant'altro dovuto, ove di importo pari almeno ad una mensilità del canone), costituisce in mora il conduttore, fatto salvo quanto previsto dall'articolo 55 della legge n. 392/78.");

    titolo("Articolo 8 (Uso)");
    par("L'immobile deve essere destinato esclusivamente ad uso di civile abitazione del conduttore." +
        (d.sublocazione ? " Viene consentita al conduttore la sublocazione e il comodato, in tutto o in parte, dell'unità immobiliare."
                        : " Salvo patto scritto contrario, è fatto divieto di sublocare o dare in comodato, in tutto o in parte, l'unità immobiliare, pena la risoluzione di diritto del contratto."));

    titolo("Articolo 9 (Recesso del conduttore)");
    par(`Il conduttore ha facoltà di recedere dal contratto per gravi motivi, previo avviso da recapitarsi mediante lettera raccomandata almeno ${preavviso(d, 3)} prima. Tale facoltà è consentita anche ad uno o più dei conduttori firmatari ed in tal caso, dal mese dell'intervenuto recesso, la locazione prosegue nei confronti degli altri, ferma restando la solidarietà del conduttore recedente per i pregressi periodi di conduzione.`);
    if (pieno(d.subentro)) par(`Le modalità di subentro sono così concordate tra le parti: ${d.subentro.trim()}${/[.]$/.test(d.subentro.trim()) ? "" : "."}`);

    titolo("Articolo 10 (Consegna)");
    par("Il conduttore dichiara di aver visitato l'unità immobiliare locatagli, di averla trovata adatta all'uso convenuto e - così - di prenderla in consegna ad ogni effetto col ritiro delle chiavi, costituendosi da quel momento custode della stessa. Il conduttore si impegna a riconsegnare l'unità immobiliare nello stato in cui l'ha ricevuta, salvo il deperimento d'uso, pena il risarcimento del danno. Si impegna altresì a rispettare le norme del regolamento dello stabile ove esistente, accusando in tal caso ricevuta dello stesso con la firma del presente contratto, così come si impegna ad osservare le deliberazioni dell'assemblea dei condomini. È in ogni caso vietato al conduttore compiere atti e tenere comportamenti che possano recare molestia agli altri abitanti dello stabile.");
    par("Le parti danno atto, in relazione allo stato dell'immobile, ai sensi dell'articolo 1590 del Codice civile, " +
        (pieno(d.stato_immobile) ? `di quanto segue: ${d.stato_immobile.trim()}${/[.]$/.test(d.stato_immobile.trim()) ? "" : "."}` : `di quanto segue: ${RIGA}${RIGA}${RIGA} ovvero di quanto risulta dall'allegato verbale di consegna.`));

    titolo("Articolo 11 (Modifiche e danni)");
    par("Il conduttore non può apportare alcuna modifica, innovazione, miglioria o addizione ai locali locati ed alla loro destinazione, o agli impianti esistenti, senza il preventivo consenso scritto del locatore. Il conduttore esonera espressamente il locatore da ogni responsabilità per danni diretti o indiretti che possano derivargli da fatti dei dipendenti del locatore medesimo nonché per interruzioni incolpevoli dei servizi.");

    titolo("Articolo 12 (Assemblee)");
    par("Il conduttore ha diritto di voto, in luogo del proprietario dell'unità immobiliare locatagli, nelle deliberazioni dell'assemblea condominiale relative alle spese ed alle modalità di gestione dei servizi di riscaldamento e di condizionamento d'aria. Ha inoltre diritto di intervenire, senza voto, sulle deliberazioni relative alla modificazione degli altri servizi comuni.");
    par("Quanto stabilito in materia di riscaldamento e di condizionamento d'aria si applica anche ove si tratti di edificio non in condominio. In tale caso (e con l'osservanza, in quanto applicabili, delle disposizioni del codice civile sull'assemblea dei condomini) i conduttori si riuniscono in apposita assemblea, convocata dalla proprietà o da almeno tre conduttori.");

    titolo("Articolo 13 (Impianti)");
    par("Il conduttore - in caso di installazione sullo stabile di antenna televisiva centralizzata - si obbliga a servirsi unicamente dell'impianto relativo, restando sin d'ora il locatore in caso di inosservanza autorizzato a far rimuovere e demolire ogni antenna individuale a spese del conduttore, il quale nulla può pretendere a qualsiasi titolo, fatte salve le eccezioni di legge.");
    par("Per quanto attiene all'impianto termico autonomo, ove presente, ai sensi della normativa del D.lgs 192/05, con particolare riferimento all'art. 7 comma 1, il conduttore subentra per la durata della detenzione alla figura del proprietario nell'onere di adempiere alle operazioni di controllo e di manutenzione.");

    titolo("Articolo 14 (Accessi)");
    par("Il conduttore deve consentire l'accesso all'unità immobiliare al locatore, al suo amministratore nonché ai loro incaricati ove gli stessi ne abbiano - motivandola - ragione.");
    par("Nel caso in cui il locatore intenda vendere o, in caso di recesso anticipato del conduttore, locare l'unità immobiliare, questi deve consentirne la visita una volta la settimana, per almeno due ore, con esclusione dei giorni festivi" +
        (pieno(d.visite) ? ` oppure con le seguenti modalità: ${d.visite.trim()}${/[.]$/.test(d.visite.trim()) ? "" : "."}` : "."));

    titolo("Articolo 15 (Commissione di negoziazione paritetica e conciliazione stragiudiziale)");
    par("La Commissione di cui all'articolo 6 del decreto del Ministro delle infrastrutture e dei trasporti di concerto con il Ministro dell'economia e delle finanze, emanato ai sensi dell'articolo 4, comma 2, della legge 431/98, è composta da due membri scelti fra appartenenti alle rispettive organizzazioni firmatarie dell'Accordo territoriale sulla base delle designazioni, rispettivamente, del locatore e del conduttore.");
    par("L'operato della Commissione è disciplinato dal documento \u201cProcedure di negoziazione e conciliazione stragiudiziale nonché modalità di funzionamento della Commissione\u201d, Allegato E, al citato decreto.");
    par("La richiesta di intervento della Commissione non determina la sospensione delle obbligazioni contrattuali.");
    par("La richiesta di attivazione della Commissione non comporta oneri.");

    titolo("Articolo 16 (Varie)");
    par("A tutti gli effetti del presente contratto, comprese la notifica degli atti esecutivi, e ai fini della competenza a giudicare, il conduttore elegge domicilio nei locali a lui locati e, ove egli più non li occupi o comunque detenga, presso l'ufficio di segreteria del Comune ove è situato l'immobile locato.");
    par("Qualunque modifica al presente contratto non può aver luogo, e non può essere provata, se non con atto scritto.");
    par("Il locatore ed il conduttore si autorizzano reciprocamente a comunicare a terzi i propri dati personali in relazione ad adempimenti connessi col rapporto di locazione (d.lgs n. 196/03).");
    par("Per quanto non previsto dal presente contratto le parti rinviano a quanto in materia disposto dal Codice civile, dalle leggi n. 392/78 e n. 431/98 o comunque dalle norme vigenti e dagli usi locali nonché alla normativa ministeriale emanata in applicazione della legge n. 431/98 ed agli Accordi di cui agli articoli 2 e 3.");
    if (pieno(d.altre_clausole)) {
      titolo("Altre clausole");
      String(d.altre_clausole).trim().split(/\n/).filter(pieno).forEach((r) => par(r.trim()));
    }
    firme(B, d, loc, con, fid, "A mente degli articoli 1341 e 1342 del Codice civile, le parti specificamente approvano i patti di cui agli articoli 2 (Natura transitoria), 4 (Deposito cauzionale e altre forme di garanzia), 5 (Oneri accessori), 7 (Pagamento, risoluzione), 9 (Recesso del conduttore), 10 (Consegna), 11 (Modifiche e danni), 13 (Impianti), 14 (Accessi), 15 (Commissione di negoziazione paritetica), 16 (Varie) del presente contratto.");
    return B;
  }

  // ------------------------------------------------------------ transitorio

  /** La fine di un contratto transitorio: N mesi piu' G giorni dalla decorrenza. */
  function fineTransitorio(decorrenza, mesi, giorni) {
    mesi = Number(mesi) || 0; giorni = Number(giorni) || 0;
    if (!giorni) return mesi ? scadenza(decorrenza, 0, mesi) : "";
    const inizio = inizioGiorni(decorrenza, mesi);
    if (!inizio) return "";
    const d = new Date(inizio + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + giorni - 1);
    return d.toISOString().slice(0, 10);
  }

  /** Il primo giorno del periodo finale in giorni: l'anniversario dopo N mesi
   *  (il primo del mese dopo, se quel giorno non esiste). */
  function inizioGiorni(decorrenza, mesi) {
    const m = String(decorrenza || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    const fine = mesi ? scadenza(decorrenza, 0, mesi) : null;
    if (!fine) return decorrenza;
    const d = new Date(fine + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  /** Il canone del transitorio, dal mensile (i giorni finali in proporzione,
   *  mese commerciale di 30 giorni) oppure dal totale per l'intera durata
   *  (diviso in mensilita' e giorni residui: la rata dei giorni prende il
   *  resto, cosi' la somma torna esatta al centesimo). "scarto" e' quanto il
   *  totale scritto non si divide in rate uguali (senza giorni residui). */
  function canoneTransitorio(d) {
    const mesi = Number(d.durata_numero) || 0, giorni = Number(d.durata_giorni) || 0;
    const tondo = (n) => Math.round(n * 100) / 100;
    if (d.canone_modo === "totale") {
      const totale = Number(d.canone_totale) || 0, unita = mesi + giorni / 30;
      if (!totale || !unita) return { mensile: 0, mesi, giorni, rataGiorni: 0, totale: 0, scarto: 0 };
      const mensile = tondo(totale / unita);
      const rataGiorni = giorni ? tondo(totale - mensile * mesi) : 0;
      const calcolato = tondo(mensile * mesi + rataGiorni);
      return { mensile: mesi ? mensile : 0, mesi, giorni, rataGiorni, totale: calcolato, scarto: tondo(totale - calcolato) };
    }
    const mensile = Number(d.canone_mensile) || 0;
    const rataGiorni = tondo(mensile / 30 * giorni);
    return { mensile, mesi, giorni, rataGiorni, totale: tondo(mensile * mesi + rataGiorni), scarto: 0 };
  }

  /** Come si paga il canone del transitorio: rate mensili, e i giorni finali. */
  function rateTransitorio(d, k) {
    const periodo = () => {
      const da = inizioGiorni(d.decorrenza, k.mesi);
      return da ? `, dal ${data(da)} al ${data(d.scadenza)}` : "";
    };
    if (!k.mesi && k.giorni) return `in un'unica soluzione anticipata alla firma del presente contratto`;
    if (!k.mesi) return `in n. ____ rate mensili anticipate di ${euro(k.mensile || null)} ciascuna, ${termineRata(d)}`;
    const mensili = k.mesi === 1 ? `in una rata mensile anticipata di ${euro(k.mensile || null)}` : `in n. ${k.mesi} rate mensili eguali anticipate di ${euro(k.mensile || null)} ciascuna`;
    if (!k.giorni) return `${mensili}, ${termineRata(d)}`;
    return `${mensili} e una rata finale di ${euro(k.rataGiorni || null)} per gli ultimi ${k.giorni} ${k.giorni === 1 ? "giorno" : "giorni"}${periodo()}, ${termineRata(d)}`;
  }

  function transitorio(d, a, imp) {
    const acc = a.accordo, B = [];
    const loc = d.locatori || [], con = d.conduttori || [], fid = (d.fideiussori || []).filter((f) => pieno(f.cf) || pieno(f.cognome));
    const par = (testo, extra = {}) => B.push(Object.assign({ t: "par", parti: Array.isArray(testo) ? testo : [P(testo)] }, extra));
    const titolo = (testo) => B.push({ t: "titolo", testo });
    // gli articoli si numerano da soli: sotto i due mesi il recesso non c'e'
    // e quelli dopo scalano; "numeri" serve all'approvazione degli artt. 1341 e 1342
    const numeri = {};
    let n = 0;
    const articolo = (nome) => { numeri[nome] = ++n; titolo(`Articolo ${n} (${nome})`); };
    const cedolare = d.cedolare !== false && !loc.some((p) => p.tipo === "giuridica");
    const accordo = `depositato il ${acc.deposito_data} presso il Comune di ${comuneAccordo(acc)} con Prot. ${acc.protocollo}${acc.ufficio_breve ? " - " + acc.ufficio_breve : ""}`;

    B.push({ t: "intestazione", righe: [
      { testo: "LOCAZIONE ABITATIVA DI NATURA TRANSITORIA", g: true, s: 13, sottolinea: true },
      { testo: "(Legge 9 dicembre 1998, n. 431, articolo 5, comma 1)", s: 11 },
      { testo: "concordato tra le Organizzazioni della proprietà e degli inquilini", s: 11 },
      { testo: `Depositato presso il Comune di ${comuneAccordo(acc)} il ${acc.deposito_data}`, s: 11 },
      { testo: `Prot. ${acc.protocollo} ${acc.ufficio_breve}`, s: 11 },
    ] });
    partiEImmobile(B, d, imp, { ruoloConduttore: "studente" });
    B.push({ t: "centro", testo: "LA LOCAZIONE È REGOLATA DALLE PATTUIZIONI SEGUENTI.", s: 12 });

    const k = canoneTransitorio(d);
    const durata = [k.mesi ? `${k.mesi} ${k.mesi === 1 ? "mese" : "mesi"}` : "", k.giorni ? `${k.giorni} ${k.giorni === 1 ? "giorno" : "giorni"}` : ""].filter(Boolean).join(" e ") || "____";
    articolo("Durata");
    par(G("Il contratto è stipulato per la durata di ", [durata], ", dal ", [data(d.decorrenza)], " al ", [data(d.scadenza)], `, allorché, fatto salvo quanto previsto dall'art. 2, cessa senza bisogno di alcuna disdetta.`));

    const chi = d.esigenza_di === "conduttore" ? "conduttore" : "locatore";
    articolo(`Esigenza del ${d.esigenza_di === "parti" ? "locatore/conduttore" : chi}`);
    if (d.esigenza_di === "parti") {
      const ac = d.assistenza_conduttore || {};
      par(`Ai sensi di quanto previsto dall'art. 2, comma 4 del decreto del Ministero delle infrastrutture e dei trasporti, ex art. 4 comma 2 legge 431/98, e dall'Accordo territoriale tra le Organizzazioni della Proprietà e dell'Inquilinato ${accordo}, le parti concordano, assistite, quanto al locatore da ${o(assistenzaLocatore(d))} e quanto al conduttore da ${o(ac.organizzazione)} in persona di ${o(ac.persona)}, che la presente locazione ha natura transitoria per il seguente motivo: ${o(d.motivo)}${/[.]$/.test(String(d.motivo || "").trim()) ? "" : "."}`);
    } else {
      par(`Il ${chi}, nel rispetto di quanto previsto dal decreto del Ministro delle infrastrutture e dei trasporti di concerto con il Ministro dell'economia e delle finanze, emanato ai sensi dell'articolo 4, comma 2, della legge n. 431/98 - di cui il presente tipo di contratto costituisce l'Allegato B - e dall'Accordo territoriale tra le Organizzazioni della Proprietà e dell'Inquilinato ${accordo}, dichiara la seguente esigenza che giustifica la transitorietà del contratto e che documenta, in caso di durata superiore a 30 giorni, allegando al presente contratto: ${o(d.motivo)}${/[.]$/.test(String(d.motivo || "").trim()) ? "" : "."}`);
    }

    articolo("Inadempimento delle modalità di stipula");
    par("Il presente contratto è ricondotto alla durata prevista dall'art. 2 comma 1 della legge 9 dicembre 1998, n. 431, in caso di inadempimento delle modalità di stipula previste dall'art. 2, commi 1, 2, 3, 4, 5 e 6 del decreto dei Ministri delle infrastrutture e dell'economia e delle finanze ex art. 4 comma 2 della legge 431/98.");
    par("In ogni caso, ove il locatore abbia riacquistato la disponibilità dell'alloggio alla scadenza dichiarando di volerlo adibire ad un uso determinato e non lo adibisca, senza giustificato motivo, nel termine di sei mesi dalla data in cui ha riacquistato la detta disponibilità, a tale uso, il conduttore ha diritto al ripristino del rapporto di locazione alle condizioni di cui all'articolo 2, comma 1, della legge n. 431/98 o, in alternativa, ad un risarcimento in misura pari a trentasei mensilità dell'ultimo canone di locazione corrisposto.");

    const totale = k.totale;
    const modi = { bonifico: "a mezzo di bonifico bancario" + (pieno(d.iban) ? ` sul conto IBAN ${d.iban.replace(/\s+/g, "").toUpperCase()}` + (pieno(d.intestatario_conto) ? ` intestato a ${d.intestatario_conto}` : "") : ""),
                   domicilio: "nel domicilio del locatore", altro: o(d.pagamento_altro) };
    articolo("Canone");
    par(G(`Nei Comuni con un numero di abitanti superiore a diecimila, come risultanti dai dati ufficiali dell'ultimo censimento, il canone di locazione, secondo quanto stabilito dall'Accordo territoriale ${accordo}, è convenuto in `, [euro(totale) + " per l'intera durata"], `, importo che il conduttore si obbliga a corrispondere ${modi[d.pagamento] || modi.bonifico}, ${rateTransitorio(d, k)}.`));

    articolo("Deposito cauzionale e altre forme di garanzia");
    const dep = d.deposito || {}, mens = pieno(dep.mensilita) ? `${dep.mensilita}` : "____";
    const coda = " non imputabile in conto canoni e produttiva di interessi legali, riconosciuti al conduttore al termine della locazione. Il deposito cauzionale così costituito viene reso al termine della locazione previa verifica dello stato dell'unità immobiliare e dell'osservanza di ogni obbligazione contrattuale.";
    if (dep.modo === "nessuno") par("A garanzia delle obbligazioni assunte col presente contratto, il conduttore non versa al locatore alcuna somma a titolo di deposito cauzionale.");
    else if (dep.modo === "precedente") par(`A garanzia delle obbligazioni assunte col presente contratto, il conduttore ha già versato al locatore, con il precedente contratto di locazione, una somma di ${euro(dep.importo)}${mensilita(dep, "n. ")}, che resta a titolo di deposito cauzionale per il presente contratto,` + coda);
    else par(`A garanzia delle obbligazioni assunte col presente contratto, il conduttore versa al locatore (che con la firma del contratto ne rilascia quietanza) una somma di ${euro(dep.importo)}${mensilita(dep, "n. ")},` + coda);
    if (pieno(d.altre_garanzie)) par(`Altre forme di garanzia: ${d.altre_garanzie.trim()}`);
    fideiussori(par, d, fid);

    articolo("Oneri accessori");
    par("Per gli oneri accessori le parti fanno applicazione della Tabella oneri accessori, allegato D al decreto emanato dal Ministro delle infrastrutture e dei trasporti di concerto con il Ministro dell'economia e delle finanze ai sensi dell'articolo 4, comma 2, della legge n. 431/1998 e di cui il presente contratto costituisce l'allegato B.");
    par("In sede di consuntivo, il pagamento degli oneri anzidetti, per la quota parte di quelli condominiali/comuni a carico del conduttore, deve avvenire entro sessanta giorni dalla richiesta. Prima di effettuare il pagamento, il conduttore ha diritto di ottenere l'indicazione specifica delle spese anzidette e dei criteri di ripartizione. Ha inoltre diritto di prendere visione - anche tramite organizzazioni sindacali - presso il locatore (o il suo amministratore o l'amministratore condominiale, ove esistente) dei documenti giustificativi delle spese effettuate. Insieme con il pagamento della prima rata del canone, il conduttore versa una quota di acconto non superiore a quella di sua spettanza risultante dal rendiconto dell'anno precedente. Sono interamente a carico del conduttore le spese relative ad ogni utenza (energia elettrica, acqua, gas, telefono e altro)." +
        (pieno(d.oneri_acconto) && Number(d.oneri_acconto) ? ` Per le spese di cui al presente articolo, il conduttore versa una quota di ${euro(d.oneri_acconto)}${pieno(d.oneri_periodo) ? " " + d.oneri_periodo.trim() : ""} salvo conguaglio.` : ""));

    articolo("Spese di bollo e di registrazione");
    if (cedolare) {
      par("Il locatore intende avvalersi delle disposizioni di cui al D.Lgs. n. 23 del 14-03-2011, cosiddetta \u201ccedolare secca\u201d. Pertanto, a norma di tale disposizione, il locatore dichiara di rinunciare all'applicazione degli adeguamenti Istat. Il presente contratto, quindi, è esente da imposta di bollo e tassa di registro. Il locatore provvede alla registrazione del contratto, ove dovuta, dandone documentata comunicazione al conduttore e all'Amministratore del condominio ai sensi dell'art. 13 legge 431 del 1998. Le parti possono delegare alla registrazione del contratto una delle organizzazioni sindacali che abbia prestato assistenza ai fini della stipula del contratto medesimo.");
    } else {
      par("Le spese di bollo per il presente contratto e per le ricevute conseguenti sono a carico del conduttore. Il locatore provvede alla registrazione del contratto, ove dovuta, dandone documentata comunicazione al conduttore - che corrisponde la quota di sua spettanza, pari alla metà - e all'Amministratore del condominio ai sensi dell'art. 13 legge 431 del 1998. Le parti possono delegare alla registrazione del contratto una delle organizzazioni sindacali che abbia prestato assistenza ai fini della stipula del contratto medesimo.");
    }

    articolo("Pagamento");
    par("Il pagamento del canone o di quant'altro dovuto anche per oneri accessori non può venire sospeso o ritardato da pretese o eccezioni del conduttore, qualunque ne sia il titolo. Il mancato puntuale pagamento, per qualsiasi causa, anche di una sola rata del canone (nonché di quant'altro dovuto, ove di importo pari almeno ad una mensilità del canone), costituisce in mora il conduttore, fatto salvo quanto previsto dall'articolo 55 della legge 27 luglio 1978, n. 392.");

    articolo("Uso");
    par("L'immobile deve essere destinato esclusivamente a civile abitazione del conduttore" +
        (pieno(d.conviventi) ? ` e delle seguenti persone attualmente con lui conviventi: ${d.conviventi.trim()}.` : ".") +
        (d.sublocazione ? " Viene consentita al conduttore la sublocazione e il comodato, in tutto o in parte, dell'unità immobiliare."
                        : " Salvo espresso patto scritto contrario, è fatto divieto di sublocare o dare in comodato, in tutto o in parte, l'unità immobiliare, pena la risoluzione di diritto del contratto.") +
        " Per la successione nel contratto si applica l'articolo 6 della legge n. 392/78, nel testo vigente a seguito della sentenza della Corte costituzionale n. 404/1988.");

    if (conRecesso(d)) {
      articolo("Recesso del conduttore");
      par(`Il conduttore ha facoltà di recedere per gravi motivi dal contratto previo avviso da recapitarsi mediante lettera raccomandata almeno ${preavviso(d, 1)} prima.`);
    }

    articolo("Consegna");
    par("Il conduttore dichiara di aver visitato l'unità immobiliare locatagli, di averla trovata adatta all'uso convenuto e, pertanto, di prenderla in consegna ad ogni effetto col ritiro delle chiavi, costituendosi da quel momento custode della stessa. Il conduttore si impegna a riconsegnare l'unità immobiliare nello stato in cui l'ha ricevuta, salvo il deperimento d'uso, pena il risarcimento del danno; si impegna, altresì, a rispettare le norme del regolamento dello stabile ove esistente, accusando in tal caso ricevuta dello stesso con la firma del presente contratto, così come si impegna ad osservare le deliberazioni dell'assemblea dei condomini. È in ogni caso vietato al conduttore compiere atti e tenere comportamenti che possano recare molestia agli altri abitanti dello stabile. Le parti danno atto, in relazione allo stato dell'unità immobiliare, ai sensi dell'articolo 1590 del Codice Civile, " +
        (pieno(d.stato_immobile) ? `di quanto segue: ${d.stato_immobile.trim()}${/[.]$/.test(d.stato_immobile.trim()) ? "" : "."}` : `di quanto segue: ${RIGA}${RIGA}${RIGA} ovvero di quanto risulta dall'allegato verbale di consegna.`));

    articolo("Modifiche e danni");
    par("Il conduttore non può apportare alcuna modifica, innovazione, miglioria o addizione ai locali locati ed alla loro destinazione, o agli impianti esistenti, senza il preventivo consenso scritto del locatore. Il conduttore esonera espressamente il locatore da ogni responsabilità per danni diretti o indiretti che possano derivargli da fatti dei dipendenti del locatore medesimo nonché per interruzioni incolpevoli dei servizi.");

    articolo("Assemblee");
    par("Il conduttore ha diritto di voto, in luogo del proprietario dell'unità immobiliare locatagli, nelle deliberazioni dell'assemblea condominiale relative alle spese ed alle modalità di gestione dei servizi di riscaldamento e di condizionamento d'aria. Ha inoltre diritto di intervenire, senza voto, sulle deliberazioni relative alla modificazione degli altri servizi comuni. Quanto stabilito in materia di riscaldamento e di condizionamento d'aria si applica anche ove si tratti di edificio non in condominio. In tale caso (e con l'osservanza, in quanto applicabili, delle disposizioni del codice civile sull'assemblea dei condomini) i conduttori si riuniscono in apposita assemblea, convocata dalla proprietà o da almeno tre conduttori.");

    articolo("Impianti");
    par("Il conduttore - in caso d'installazione sullo stabile di antenna televisiva centralizzata - si obbliga a servirsi unicamente dell'impianto relativo, restando sin d'ora il locatore, in caso di inosservanza, autorizzato a far rimuovere e demolire ogni antenna individuale a spese del conduttore, il quale nulla può pretendere a qualsiasi titolo, fatte salve le eccezioni di legge. Per quanto attiene all'impianto termico autonomo, ove presente, ai sensi della normativa del d.lgs n. 192/05, con particolare riferimento all'art. 7 comma 1, il conduttore subentra per la durata della detenzione alla figura del proprietario nell'onere di adempiere alle operazioni di controllo e di manutenzione.");

    articolo("Accesso");
    par("Il conduttore deve consentire l'accesso all'unità immobiliare al locatore, al suo amministratore nonché ai loro incaricati ove gli stessi ne abbiano - motivandola - ragione. Nel caso in cui il locatore intenda vendere o, in caso di recesso anticipato del conduttore, locare l'unità immobiliare, questi deve consentirne la visita una volta la settimana, per almeno due ore, con esclusione dei giorni festivi" +
        (pieno(d.visite) ? ` oppure con le seguenti modalità: ${d.visite.trim()}${/[.]$/.test(d.visite.trim()) ? "" : "."}` : "."));

    articolo("Commissione di negoziazione paritetica e conciliazione stragiudiziale");
    par("La Commissione di cui all'articolo 6 del decreto del Ministro delle infrastrutture e dei trasporti di concerto con il Ministro dell'economia e delle finanze, emanato ai sensi dell'articolo 4, comma 2, della legge 431 del 1998, è composta da due membri scelti fra appartenenti alle rispettive organizzazioni firmatarie dell'Accordo Territoriale sulla base delle designazioni, rispettivamente, del locatore e del conduttore.");
    par("L'operato della Commissione è disciplinato dal documento \u201cProcedure di negoziazione e conciliazione stragiudiziale nonché modalità di funzionamento della Commissione\u201d, Allegato E al sopracitato decreto. La richiesta di intervento della Commissione non determina la sospensione delle obbligazioni contrattuali. La richiesta di attivazione della Commissione non comporta oneri.");

    articolo("Varie");
    par("A tutti gli effetti del presente contratto, comprese la notifica degli atti esecutivi, e ai fini della competenza a giudicare, il conduttore elegge domicilio nei locali a lui locati e, ove egli più non li occupi o comunque detenga, presso l'ufficio di segreteria del Comune ove è situato l'immobile locato.");
    par("Qualunque modifica al presente contratto non può aver luogo, e non può essere provata, se non con atto scritto. Il locatore ed il conduttore si autorizzano reciprocamente a comunicare a terzi i propri dati personali in relazione ad adempimenti connessi col rapporto di locazione (d.Lgs n. 196/03). Per quanto non previsto dal presente contratto le parti rinviano a quanto in materia disposto dal Codice civile, dalle leggi n. 392/78 e n. 431/98 o comunque dalle norme vigenti e dagli usi locali nonché alla normativa ministeriale emanata in applicazione della legge n. 431/98 ed all'Accordo territoriale.");
    if (pieno(d.altre_clausole)) {
      titolo("Altre clausole");
      String(d.altre_clausole).trim().split(/\n/).filter(pieno).forEach((r) => par(r.trim()));
    }
    const esigenza = `Esigenza del ${d.esigenza_di === "parti" ? "locatore/conduttore" : chi}`;
    const approvati = [esigenza, "Inadempimento delle modalità di stipula", "Canone", "Deposito cauzionale e altre forme di garanzia",
      "Oneri accessori", ["Pagamento", "Pagamento, risoluzione"], "Uso", "Recesso del conduttore", "Consegna", "Modifiche e danni", "Impianti",
      "Accesso", "Commissione di negoziazione paritetica e conciliazione stragiudiziale", "Varie"]
      .map((x) => (Array.isArray(x) ? x : [x, x])).filter(([k]) => numeri[k]).map(([k, nome]) => `${numeri[k]} (${nome})`);
    firme(B, d, loc, con, fid, `A mente degli articoli 1341 e 1342 del Codice civile, le parti specificamente approvano i patti di cui agli articoli ${approvati.slice(0, -1).join(", ")} e ${approvati[approvati.length - 1]} del presente contratto.`);
    return B;
  }

  // ------------------------------------------------------------ finalita' turistiche

  function turistico(d, a, imp) {
    const B = [];
    const loc = d.locatori || [], con = d.conduttori || [], fid = (d.fideiussori || []).filter((f) => pieno(f.cf) || pieno(f.cognome));
    const par = (testo, extra = {}) => B.push(Object.assign({ t: "par", parti: Array.isArray(testo) ? testo : [P(testo)] }, extra));
    const cedolare = d.cedolare !== false && !loc.some((p) => p.tipo === "giuridica");

    B.push({ t: "intestazione", righe: [
      { testo: "CONTRATTO PER FINALITÀ TURISTICA", g: true, s: 14, sottolinea: true },
      { testo: "Ai sensi dell'art. 1, secondo comma, lettera c),", s: 11.5 },
      { testo: "Legge 9 dicembre 1998, n. 431", s: 11.5 },
    ] });
    partiEImmobile(B, d, imp, { ruoloConduttore: "studente" });
    B.push({ t: "centro", testo: "LA LOCAZIONE È REGOLATA DALLE SEGUENTI PATTUIZIONI.", s: 12 });

    const k = canoneTransitorio(d);
    const modi = { bonifico: "a mezzo di bonifico bancario" + (pieno(d.iban) ? ` sul conto IBAN ${d.iban.replace(/\s+/g, "").toUpperCase()}` + (pieno(d.intestatario_conto) ? ` intestato a ${d.intestatario_conto}` : "") : ""),
                   domicilio: "nel domicilio del locatore", altro: o(d.pagamento_altro) };
    par(G("1) Il contratto è stipulato per il periodo dal ", [data(d.decorrenza)], " al ", [data(d.scadenza)],
          ", allorché cesserà senza bisogno di disdetta alcuna, che s'intende sin d'ora data per allora." +
          (conRecesso(d) ? ` Il conduttore può recedere anticipatamente dal contratto con preavviso di ${preavviso(d, 1)}, da comunicare al locatore con lettera raccomandata.` : "")));
    par("2) L'immobile dovrà essere destinato esclusivamente ad uso di civile abitazione ed essere solamente per finalità turistica, come infra precisato.");
    par("3) Il conduttore non potrà sublocare o dare in comodato, in tutto o in parte, l'unità immobiliare, pena la risoluzione di diritto del contratto.");
    par(G("4) Il canone per l'intero periodo della locazione - avendo le parti tenute presenti le condizioni oggettive dell'immobile anche sopra descritte e ben note, e la sua ubicazione - è convenuto in ",
          [euro(k.totale)], `, che il conduttore si obbliga a corrispondere ${modi[d.pagamento] || modi.bonifico}, ${rateTransitorio(d, k)}.`));
    par("5) Il pagamento del canone o di quant'altro dovuto anche per oneri accessori non potrà essere sospeso o ritardato da pretese o eccezioni del conduttore, qualunque ne sia il titolo. Il mancato puntuale pagamento, per qualunque causa, anche di una sola rata del canone (nonché di quant'altro dovuto ove di importo pari ad una mensilità del canone), costituisce subito in mora il conduttore, anche al fine del decorso degli interessi che vengono pattuiti nella misura dell'8%.");
    par("6) Il conduttore dovrà consentire di accedere all'unità immobiliare locata al locatore, al suo amministratore nonché ai loro incaricati ove gli stessi ne abbiano, motivandola, ragione.");
    par("7) Il conduttore dichiara di aver visitato l'unità immobiliare di cui al presente contratto e di averla trovata adatta all'uso convenuto e, così, di prenderla in consegna ad ogni effetto con il ritiro delle chiavi, costituendosi da quel momento della medesima custode. Il conduttore si impegna a riconsegnare l'unità immobiliare locata nello stato medesimo in cui l'ha ricevuta salvo il deperimento d'uso, pena il risarcimento del danno.");
    par("Il conduttore si impegna a rispettare le norme del regolamento condominiale dello stabile ove esistente, di cui dichiara di aver preso conoscenza, così come si impegna ad osservare le deliberazioni dell'assemblea dei condomini. È in ogni caso vietato al conduttore di compiere atti, e tenere comportamenti, che possano recare molestia agli altri abitanti dello stabile.");
    par("8) Il conduttore non potrà apportare nessuna modifica, innovazione, miglioria o addizione ai locali locati ed alla loro destinazione, o agli impianti esistenti, senza il preventivo consenso del locatore. Quanto alle eventuali migliorie e addizioni che venissero comunque eseguite anche con la tolleranza della parte locatrice, questa avrà facoltà di ritenerle senza obbligo di corrispondere indennizzo o compenso alcuno, rinunciandovi espressamente il conduttore fin d'ora. In caso contrario, la parte conduttrice avrà l'obbligo - a semplice richiesta del locatore, anche nel corso della locazione - della rimessa in pristino, a proprie spese.");
    par("9) Il conduttore esonera espressamente il locatore da ogni responsabilità per i danni diretti o indiretti che potessero derivargli da fatto dei dipendenti del locatore medesimo nonché per interruzioni incolpevoli dei servizi.");
    const dep = d.deposito || {}, mens = pieno(dep.mensilita) ? `${dep.mensilita}` : "____";
    const coda = " non imputabile in conto pigioni ed infruttifera. Il deposito cauzionale come sopra costituito viene reso al termine della locazione previa verifica dello stato dell'unità immobiliare e dell'osservanza di ogni obbligazione contrattuale.";
    if (dep.modo === "nessuno") par("10) A garanzia delle obbligazioni tutte che assume con il presente contratto il conduttore non versa al locatore alcuna somma a titolo di deposito cauzionale.");
    else if (dep.modo === "precedente") par(G("10) A garanzia delle obbligazioni tutte che assume con il presente contratto, ivi compresa la restituzione dell'immobile alla data di scadenza, il conduttore ha già versato al locatore, con il precedente contratto di locazione, una somma di ", [euro(dep.importo)], mensilita(dep) + "," + coda));
    else par(G("10) A garanzia delle obbligazioni tutte che assume con il presente contratto, ivi compresa la restituzione dell'immobile alla data di scadenza, il conduttore versa al locatore una somma di ", [euro(dep.importo)], mensilita(dep) + "," + coda));
    if (pieno(d.altre_garanzie)) par(`Altre forme di garanzia: ${d.altre_garanzie.trim()}`);
    fideiussori(par, d, fid);
    par("11) Sono interamente a carico del conduttore le spese relative al servizio di pulizia e ad ogni utenza (energia elettrica, acqua, gas, telefono, tassa rifiuti) anche se intestate al locatore.");
    par("12) Nel caso in cui il locatore intendesse vendere la casa locata, il conduttore dovrà consentire la visita all'unità immobiliare due ore la settimana" +
        (pieno(d.visite) ? `, con le seguenti modalità: ${d.visite.trim()}${/[.]$/.test(d.visite.trim()) ? "" : "."}` : "."));
    if (cedolare) {
      par("13) Il locatore intende avvalersi delle disposizioni di cui al D.Lgs. n. 23 del 14-03-2011, cosiddetta \u201ccedolare secca\u201d. Pertanto, a norma di tale disposizione, il locatore dichiara di rinunciare all'applicazione degli adeguamenti Istat. Il presente contratto, quindi, è esente da imposta di bollo e tassa di registro. È facoltà del locatore recedere dalla tassazione della cedolare secca e in tal caso il canone sarà adeguato annualmente con l'applicazione dell'Istat al 75%.");
    } else {
      par("13) Le spese di bollo per il presente contratto e per le ricevute conseguenti sono a carico del conduttore. Il locatore provvede alla registrazione del contratto, ove dovuta, dandone documentata comunicazione al conduttore, che corrisponde la quota di sua spettanza, pari alla metà.");
    }
    par("Le parti possono delegare alla registrazione del contratto una delle organizzazioni sindacali che abbia prestato assistenza ai fini della stipula del contratto medesimo.");
    par("14) Qualunque modifica al presente contratto non può aver luogo, e non può essere provata, se non mediante atto scritto.");
    par("15) Il locatore ed il conduttore si autorizzano reciprocamente a comunicare a terzi i propri dati personali in relazione ad adempimenti connessi col rapporto di locazione (d.Lgs n. 196/03).");
    par("16) La conclusione del presente contratto non comporta di per sé il trasferimento al locatario, con o senza corrispettivo, di quanto locato (art. 121, quarto comma, lett. f, D.L. 01-09-1993, n. 385).");
    par("17) Per quanto non previsto dal presente contratto le parti fanno esclusivo rinvio alle disposizioni del codice civile ed agli usi locali.");
    if (pieno(d.altre_clausole)) {
      B.push({ t: "titolo", testo: "Altre clausole" });
      String(d.altre_clausole).trim().split(/\n/).filter(pieno).forEach((r) => par(r.trim()));
    }
    par("Le parti espressamente dichiarano e si danno reciprocamente atto:");
    par(`- che l'unità immobiliare è concessa in locazione esclusivamente per finalità turistica, e più precisamente al solo scopo di ${o(d.finalita, "casa vacanza")}, esclusa ogni altra finalità;`, { rientro: 1 });
    par(`- che l'unità immobiliare verrà utilizzata dal conduttore esclusivamente quale abitazione secondaria, dichiarando il medesimo di avere la sua abitazione principale nel comune di ${o(d.abitazione_principale)}, come da autocertificazione allegata;`, { rientro: 1 });
    par("- che il locatore si è determinato alla conclusione del presente contratto esclusivamente in funzione di quanto dal conduttore come sopra dichiarato.", { rientro: 1 });
    firme(B, d, loc, con, fid, "A mente dell'articolo 1342, secondo comma, del codice civile, le parti specificamente approvano i patti di cui ai punti 1, 2, 4, 5, 6, 8, 9, 10, 11, 14 e 17 del presente contratto.");
    return B;
  }

  // ------------------------------------------------------------ canone libero 4+4

  function libero(d, a, imp) {
    const B = [];
    const loc = d.locatori || [], con = d.conduttori || [], fid = (d.fideiussori || []).filter((f) => pieno(f.cf) || pieno(f.cognome));
    const par = (testo, extra = {}) => B.push(Object.assign({ t: "par", parti: Array.isArray(testo) ? testo : [P(testo)] }, extra));
    const cedolare = d.cedolare !== false && !loc.some((p) => p.tipo === "giuridica");

    B.push({ t: "intestazione", righe: [
      { testo: "CONTRATTO DI LOCAZIONE AD USO ABITATIVO", g: true, s: 14, sottolinea: true },
      { testo: "ai sensi dell'art. 2, comma 1,", s: 12 },
      { testo: "Legge 9 dicembre 1998, n. 431", s: 12 },
    ] });
    partiEImmobile(B, d, imp, { ruoloConduttore: "conduttore" });
    B.push({ t: "centro", testo: "PATTI E CONDIZIONI", g: true, s: 12 });

    par("1) Per la stipula del presente contratto le parti, di comune accordo, si avvalgono dell'assistenza dell'U.P.P.I., dichiarando che i patti di cui ai successivi articoli rispondono pienamente alla loro volontà.");
    par(G("2) La durata della locazione è pattuita in ", ["anni 4"], " dal ", [data(d.decorrenza)], " al ", [data(d.scadenza)], "."));
    par("Il locatore, alla prima scadenza, ha diritto di recedere ove intenda adibire l'immobile agli usi o effettuare sullo stesso le opere di cui all'art. 3 della Legge 431/98. La dichiarazione motivata di diniego di rinnovo del contratto alla prima scadenza, per i motivi di cui all'art. 3 della Legge 431/98, deve essere comunicata dal locatore mediante lettera raccomandata da inviarsi al domicilio del conduttore almeno sei mesi prima della scadenza.");
    par("Alla seconda scadenza contrattuale il contratto si intenderà rinnovato di ulteriori quattro anni ed alle medesime condizioni contrattuali del precedente atto, ove i contraenti omettano di attivare la procedura del rinnovo a nuove condizioni. La parte interpellata deve rispondere a mezzo lettera raccomandata entro 60 (sessanta) giorni dalla ricezione della raccomandata. Al fine di evitare il rinnovo tacito il locatore deve comunicare la propria intenzione con lettera raccomandata da inviarsi almeno sei mesi prima della scadenza del contratto.");
    par(`3) Il conduttore può recedere dal contratto in qualsiasi momento con preavviso di ${preavviso(d, 3)}, da comunicare con lettera raccomandata con ricevuta di ritorno.`);
    const annuo = Number(d.canone_annuo) || 0, rate = Number(d.rate) || 12;
    const modi = { bonifico: "a mezzo di bonifico bancario" + (pieno(d.iban) ? ` sul conto IBAN ${d.iban.replace(/\s+/g, "").toUpperCase()}` + (pieno(d.intestatario_conto) ? ` intestato a ${d.intestatario_conto}` : "") : ""),
                   domicilio: "nel domicilio del locatore", altro: o(d.pagamento_altro) };
    par(G("4) Le parti pattuiscono il canone in ", [euro(annuo) + " annui"], `. Il canone dovrà essere corrisposto in ${rate === 12 ? "rate mensili" : `n. ${rate} rate`} anticipate di ${euro(annuo ? annuo / rate : null)} ciascuna, da versare ${modi[d.pagamento] || modi.bonifico} ${termineRata(d)}.`));
    if (!cedolare) par(`Il canone sarà aggiornato annualmente, a decorrere dall'inizio del secondo anno di locazione, nella misura del ${o(d.istat, "75%")} della variazione, accertata dall'ISTAT, dell'indice dei prezzi al consumo per le famiglie di operai e impiegati verificatasi nell'anno precedente.`);
    par("5) Ai sensi degli artt. 5 e 55 della Legge 392/78 il mancato pagamento anche di una sola rata mensile del canone e delle spese condominiali costituisce inadempimento contrattuale.");
    const acconto = pieno(d.oneri_acconto) && Number(d.oneri_acconto) ? Lettere.cifre(d.oneri_acconto) : RIGA;
    par("6) Sono interamente a carico del conduttore gli oneri accessori, nessuno escluso, compreso il compenso dell'amministratore, la cancelleria e la polizza del fabbricato. " +
        (d.oneri_modo === "amministratore"
          ? "Le relative somme saranno corrisposte dal conduttore direttamente all'amministratore dello stabile."
          : `Le relative somme saranno corrisposte dal conduttore direttamente al locatore mensilmente, unitamente al canone di locazione, ed ammontano ad € ${acconto} mensili, salvo conguaglio. Il conduttore si impegna comunque a rimborsare immediatamente il locatore qualora questi debba per qualsiasi ragione eseguire il pagamento.`));
    par("7) La tassa comunale sullo smaltimento dei rifiuti solidi urbani e tutte le utenze sono a carico del conduttore per tutto il periodo della locazione, e lo stesso si impegna a volturarle a suo nome.");
    par("8) Le spese di manutenzione straordinaria o comunque erogate in funzione di interventi di carattere straordinario sull'edificio (ristrutturazione, sostituzione di impianti, ecc.) sono a carico del locatore.");
    par(d.sublocazione ? "9) Viene consentita al conduttore la sublocazione, totale o parziale, dell'immobile."
                       : "9) Il conduttore non può sublocare né totalmente né parzialmente l'immobile salvo consenso del locatore prestato in forma scritta.");
    par("10) Il conduttore si obbliga a non apportare alcuna modifica ai locali, nonché agli impianti tutti, senza il preventivo consenso prestato per iscritto dal locatore, pena la nullità. I miglioramenti e le addizioni eventualmente autorizzati restano a favore del locatore al termine del rapporto senza che da questo sia dovuto compenso alcuno.");
    const dep = d.deposito || {};
    const coda = " quale deposito cauzionale fruttifero di interessi legali, i quali verranno corrisposti al conduttore ad ogni scadenza annuale. Tale deposito, non imputabile in conto pigioni, sarà restituito al termine della locazione previa verifica dello stato dell'immobile e sempre che il conduttore abbia adempiuto a tutti gli obblighi derivanti dal contratto di locazione.";
    if (dep.modo === "nessuno") par("11) Il conduttore non versa al locatore alcuna somma a titolo di deposito cauzionale.");
    else if (dep.modo === "precedente") par(G("11) Per assicurare al locatore l'assoluta integrità ed il buono stato dell'immobile durante il rapporto contrattuale e fino al momento della riconsegna, resta presso il locatore la somma di ", [euro(dep.importo)], mensilita(dep), ", già versata dal conduttore con il precedente contratto di locazione," + coda));
    else par(G("11) Per assicurare al locatore l'assoluta integrità ed il buono stato dell'immobile durante il rapporto contrattuale e fino al momento della riconsegna, il conduttore si obbliga a versare al momento della stipulazione del presente contratto, nelle mani del locatore, la somma di ", [euro(dep.importo)], mensilita(dep), "," + coda));
    if (pieno(d.altre_garanzie)) par(`Altre forme di garanzia: ${d.altre_garanzie.trim()}`);
    fideiussori(par, d, fid);
    par("12) Tutte le riparazioni ordinarie di cui agli artt. 1576 e 1609 c.c. sono a carico del conduttore, così come ogni altra inerente agli impianti ed ai servizi. Il locatore potrà sostituirsi al conduttore, qualora questi non vi provveda tempestivamente, ed il relativo costo dovrà essergli rimborsato entro trenta giorni dalla avvenuta riparazione. In caso contrario, la somma sborsata sarà prelevata dal deposito cauzionale, che dovrà essere immediatamente integrato dal conduttore.");
    par("13) Il conduttore assume tutti i rischi derivanti dalle possibili attività, poste in essere dai terzi aventi la materiale disposizione dell'immobile, che cagionino ad esso danni (spargimento di acqua, fughe di gas ed ogni altro abuso o trascuratezza della cosa locata).");
    par("14) Il conduttore si impegna, tramite preventiva richiesta, a consentire al locatore o ai suoi incaricati l'accesso nell'immobile oggetto del presente contratto, per controllare lo stato di manutenzione dello stesso e per mostrarlo a coloro che volessero acquistarlo o prenderlo in locazione" +
        (pieno(d.visite) ? `, con le seguenti modalità: ${d.visite.trim()}${/[.]$/.test(d.visite.trim()) ? "" : "."}` : "."));
    par("15) Le parti convengono la clausola risolutiva espressa in caso di inadempimento alle obbligazioni contenute nei precedenti articoli 4, 6, 7, 9, 10, 13.");
    if (cedolare) {
      par("16) Il locatore intende avvalersi delle disposizioni di cui al D.Lgs. n. 23 del 14-03-2011, cosiddetta \u201ccedolare secca\u201d. Pertanto, a norma di tale disposizione, il locatore rinuncia, e il conduttore ne prende atto, a qualunque aumento del canone ed all'applicazione degli adeguamenti Istat. Il presente contratto, quindi, è esente da imposta di bollo e tassa di registro. È facoltà del locatore recedere dalla tassazione della cedolare secca e in tal caso il canone sarà adeguato annualmente con l'applicazione dell'Istat al 100%.");
    } else {
      par("16) Le spese di bollo per il presente contratto e per le ricevute conseguenti sono a carico del conduttore. L'imposta di registro è a carico del locatore e del conduttore in parti uguali. Il locatore provvede alla registrazione del contratto, dandone documentata comunicazione al conduttore.");
    }
    par("Le parti possono delegare alla registrazione del contratto una delle organizzazioni sindacali che abbia prestato assistenza ai fini della stipula del contratto medesimo.");
    if (pieno(d.altre_clausole)) {
      B.push({ t: "titolo", testo: "Altre clausole" });
      String(d.altre_clausole).trim().split(/\n/).filter(pieno).forEach((r) => par(r.trim()));
    }
    firme(B, d, loc, con, fid, "A norma degli artt. 1341 e 1342 c.c. le parti, previa lettura delle norme convenute nel presente contratto, con particolare riferimento agli artt. 4, 6, 7, 8, 9, 10, 14, 15 e 16 del contratto, lo sottoscrivono ed accettano espressamente.");
    return B;
  }

  // ------------------------------------------------------------ comodato

  function comodato(d, a, imp) {
    const B = [];
    const com = d.locatori || [], tari = d.conduttori || [], i = d.immobile || {};
    const par = (testo, extra = {}) => B.push(Object.assign({ t: "par", parti: Array.isArray(testo) ? testo : [P(testo)] }, extra));

    B.push({ t: "intestazione", righe: [
      { testo: "CONTRATTO DI COMODATO", g: true, s: 15, sottolinea: true },
      { testo: "(artt. 1803 - 1812 del Codice Civile)", s: 12 },
    ] });
    // il comodante, proprietario dell'immobile
    elencoParti(com, "locatore").forEach((b) => par(b.parti, { rientro: b.rientro }));
    par(`in seguito ${plurale(com) ? accorda(com, "indicat") + ", congiuntamente," : accorda(com, "indicat")} con la qualifica di comodante, nella qualità di ${plurale(com) ? "proprietari" : femmina(com[0]) ? "proprietaria" : "proprietario"} dell'immobile di seguito descritto,`);
    B.push({ t: "centro", testo: plurale(com) ? "CONCEDONO IN COMODATO" : "CONCEDE IN COMODATO", g: true, s: 12 });
    // il comodatario, con l'eventuale parentela
    const righe = elencoParti(tari, "locatore", true);
    if (pieno(d.parentela) && righe.length === 1) {
      // subito dopo il nome: "Al sig. Luca MARIANI (padre del comodante) C.F. ..."
      const p = righe[0].parti, k = p.findIndex((x) => x.g);
      if (k >= 0) p.splice(k + 1, 0, P(` (${d.parentela.trim()} del comodante)`));
    }
    righe.forEach((b) => par(b.parti, { rientro: b.rientro }));
    if (pieno(d.parentela) && righe.length > 1) par(`(${d.parentela.trim()} del comodante)`);
    par(`in seguito ${plurale(tari) ? accorda(tari, "indicat") + ", congiuntamente," : accorda(tari, "indicat")} con la qualifica di comodatario,`);
    par(immobile(i));
    const unita = unitaCatastali(i);
    if (unita.length === 1) par([P("Estremi catastali identificativi: "), ...unita[0], P(".")], { rientro: 1 });
    else {
      par("Estremi catastali identificativi:", { rientro: 1 });
      unita.forEach((u, k) => par([P("- "), ...u, P(k < unita.length - 1 ? ";" : ".")], { rientro: 2 }));
    }
    B.push({ t: "centro", testo: "LE PARTI CONVENGONO QUANTO SEGUE", g: true, s: 12 });

    par(G("1) CONSEGNA - Il comodante consegna al comodatario, che accetta, ", ["a partire dal " + data(d.decorrenza)], ", il bene come sopra descritto, nello stato di fatto in cui si trova, affinché se ne serva per il tempo previsto dal successivo punto 3."));
    par("2) USO - Il comodatario si obbliga ad usare il bene con la diligenza del buon padre di famiglia" + (pieno(d.uso_comodato) ? `, esclusivamente quale ${d.uso_comodato.trim()}` : "") + ", e a non concederne a terzi il godimento senza il consenso del comodante.");
    if (d.durata_comodato === "determinata") {
      par(G("3) DURATA - La durata del comodato è convenuta ", ["fino al " + data(d.scadenza)], ", ai sensi dell'art. 1809 del codice civile. Il comodatario è tenuto a restituire il bene alla scadenza convenuta; il comodante può tuttavia esigerne la restituzione immediata se sopravviene un urgente e impreveduto bisogno."));
    } else {
      par(G("3) DURATA - La durata del comodato è convenuta ", ["a tempo indeterminato"], ", ai sensi dell'art. 1810 del codice civile, fatto salvo il diritto del comodante di chiedere la riconsegna del bene in qualsiasi momento, a semplice richiesta."));
    }
    par(`4) RESTITUZIONE - Il comodatario si obbliga a restituire al comodante il bene pienamente disponibile e nello stato in cui si trovava all'atto della consegna, salvo il deterioramento dovuto all'uso.` +
        (conRecesso(d) ? ` Il comodatario può restituire il bene anche prima della scadenza, dandone comunicazione al comodante con preavviso di ${preavviso(d, 1)}.` : ""));
    par("5) NORME - Il presente contratto, per quanto non espressamente scritto, è disciplinato esclusivamente dalle norme del Capo XIV (artt. da 1803 a 1812) del Codice Civile.");
    const spese = d.spese_comodato === "comodante" ? "a carico del comodante" : d.spese_comodato === "metà" ? "a carico del comodante e del comodatario in parti uguali" : `a carico ${plurale(tari) ? "dei comodatari" : "del comodatario"}`;
    par(`6) SPESE - Le spese del presente atto, compresa la registrazione, sono ${spese}.`);
    par(`7) PRESTAZIONE ENERGETICA - Il comodatario dichiara di aver ricevuto le informazioni e la documentazione in ordine alla attestazione della prestazione energetica dell'immobile (classe ${o(i.classe_energetica, "____")}).`);
    if (pieno(d.altre_clausole)) {
      B.push({ t: "titolo", testo: "Altre clausole" });
      String(d.altre_clausole).trim().split(/\n/).filter(pieno).forEach((r) => par(r.trim()));
    }
    const f = d.firma || {};
    B.push({ t: "spazio", h: 6 });
    B.push({ t: "par", parti: [P("Letto, confermato e sottoscritto.")] });
    B.push({ t: "par", parti: [P(`${o(f.luogo)}, lì ${pieno(f.data) ? data(f.data) : RIGA}`)] });
    const sin = (com.length ? com : [{}]).map((p) => chiFirma(p, "Il comodante"));
    const des = (tari.length ? tari : [{}]).map((p) => chiFirma(p, "Il comodatario"));
    const righeF = [];
    for (let k = 0; k < Math.max(sin.length, des.length); k++) righeF.push([sin[k] || null, des[k] || null]);
    B.push({ t: "firme", righe: righeF, insieme: true });
    return B;
  }

  /** Chi firma: il ruolo, e il nome in grassetto. */
  function chiFirma(p, ruolo) {
    if (!p || (!pieno(p.cognome) && !pieno(p.denominazione))) return { ruolo, nome: "" };
    return { ruolo, nome: p.tipo === "giuridica" ? p.denominazione.trim()
                                                  : `${pieno(p.nome) ? p.nome.trim() + " " : ""}${p.cognome.trim().toUpperCase()}` };
  }

  /** Le righe delle firme: i locatori a sinistra; a destra i conduttori e,
   *  sotto di loro, i fideiussori. */
  function righeFirme(loc, con, fid) {
    const sinistra = (loc.length ? loc : [{}]).map((p) => chiFirma(p, "Il locatore"));
    const destra = [...(con.length ? con : [{}]).map((p) => chiFirma(p, "Il conduttore")),
                    ...fid.map((p) => chiFirma(p, "Il fideiussore"))];
    const righe = [];
    for (let k = 0; k < Math.max(sinistra.length, destra.length); k++) righe.push([sinistra[k] || null, destra[k] || null]);
    return righe;
  }

  const APPROVA_3_PIU_2 = "A mente degli articoli 1341 e 1342 del codice civile, le parti specificamente approvano i patti di cui agli articoli 3 (Deposito cauzionale e altre forme di garanzia), 4 (Oneri accessori), 6 (Pagamento, risoluzione), 9 (Consegna), 10 (Modifiche e danni), 12 (Impianti), 13 (Accesso), 14 (Commissione di negoziazione paritetica e conciliazione stragiudiziale) e 15 (Varie) del presente contratto.";

  function firme(B, d, loc, con, fid, approva = APPROVA_3_PIU_2) {
    const f = d.firma || {};
    B.push({ t: "spazio", h: 6 });
    B.push({ t: "par", parti: [P("Letto, approvato e sottoscritto")] });
    B.push({ t: "par", parti: [P(`${o(f.luogo)}, lì ${pieno(f.data) ? data(f.data) : RIGA}`)] });
    B.push({ t: "firme", righe: righeFirme(loc, con, fid) });
    B.push({ t: "par", insieme: true, parti: [P(approva)] });
    B.push({ t: "firme", righe: righeFirme(loc, con, fid), insieme: true });
    if (CONCORDATI.includes(d.tipo || "agevolato") || assistenzaLocatore(d)) {
      B.push({ t: "spazio", h: 6, insieme: true });
      B.push({ t: "firma_centro", testo: "PER PRESTATA ASSISTENZA", insieme: true });
    }
  }

  /** I contratti a canone concordato: l'associazione assiste o attesta. */
  const CONCORDATI = ["agevolato", "studenti", "transitorio"];

  /** "UPPI in persona di Mario Rossi": l'associazione che assiste il
   *  locatore, scelta da chi compila. Nei concordati, se manca, restano le
   *  righe da compilare; negli altri contratti la frase non c'e'. */
  function assistenzaLocatore(d) {
    const a = d.assistenza_locatore || {};
    if (!pieno(a.organizzazione) && !CONCORDATI.includes(d.tipo || "agevolato")) return "";
    return `${o(a.organizzazione)} in persona di ${o(a.persona)}`;
  }

  /** Il Comune dell'accordo ("Roma"). */
  const comuneAccordo = (acc) => (acc && acc.comune) || "Roma";

  // ------------------------------------------------------------ date

  /** Il giorno entro cui si paga la rata: cinque giorni dopo quello di
   *  inizio (dal 15 entro il 20, dal 10 entro il 15); dal 1° entro il 5. */
  function giornoPagamento(decorrenza) {
    const m = String(decorrenza || "").match(/^\d{4}-\d{2}-(\d{2})$/);
    if (!m) return 5;
    const g = Number(m[1]);
    return g === 1 ? 5 : g + 5;
  }

  /** "entro il 20 di ogni mese"; oltre il 30 si passa al mese successivo. */
  function termineRata(d) {
    const g = Number(d.giorno_pagamento) || giornoPagamento(d.decorrenza);
    return g > 30 ? `entro il giorno ${g - 30} del mese successivo` : `entro il ${g} di ogni mese`;
  }

  /** La fine del contratto: dalla decorrenza, N anni meno un giorno. */
  function scadenza(decorrenza, anni, mesi = 0) {
    const m = String(decorrenza || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    const anno = +m[1] + (Number(anni) || 0), mese = +m[2] - 1 + (Number(mesi) || 0);
    let d = new Date(Date.UTC(anno, mese, +m[3]));
    // il giorno di anniversario non esiste (29 febbraio, 31 aprile...): vale il primo del mese dopo
    if (d.getUTCDate() !== +m[3]) d = new Date(Date.UTC(anno, mese + 1, 1));
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  const MODELLI = {
    agevolato: { nome: "Abitativo agevolato 3+2", genera: agevolato },
    studenti: { nome: "Studenti universitari", genera: studenti },
    transitorio: { nome: "Transitorio", genera: transitorio },
    turistico: { nome: "Finalità turistiche", genera: turistico },
    libero: { nome: "Canone libero 4+4", genera: libero },
    comodato: { nome: "Comodato", genera: comodato },
  };

  function genera(dati, accordo, impostazioni = {}) {
    const m = MODELLI[dati.tipo || "agevolato"];
    if (!m) throw new Error("Tipo di contratto non previsto: " + dati.tipo);
    // Accordi senza estremi di deposito pubblicati (Milano): invece di "depositato
    // il … con protocollo …" il contratto cita le date di firma dell'accordo, e
    // le frasi sul protocollo si tolgono. Roma (con deposito e protocollo) non cambia.
    const a = accordo && accordo.accordo;
    if (!a || (a.deposito_data && a.protocollo)) return m.genera(dati, accordo, impostazioni);
    const PROT = "\u0000PROT\u0000", DEP = "\u0000DEP\u0000";
    accordo = Object.assign({}, accordo, { accordo: Object.assign({}, a, {
      deposito_data: a.deposito_data || DEP, protocollo: a.protocollo || PROT }) });
    const firma = `sottoscritto il ${a.data_testo}` + (a.integrazione_testo ? ` e integrato il ${a.integrazione_testo}` : "");
    return senzaEstremi(m.genera(dati, accordo, impostazioni), PROT, DEP, firma);
  }

  /** Toglie "con Protocollo n. …", ", n° Prot. …", "con Prot. …"; mette le date
   *  di firma al posto di "depositato il …"; via le righe d'intestazione rimaste
   *  vuote o ripetute ("quale allegato dell'accordo sottoscritto il …"). */
  function senzaEstremi(blocchi, PROT, DEP, firma) {
    const prot = new RegExp(`,?\\s*(?:con\\s+)?(?:n°\\s*)?(?:Protocollo|Prot\\.)\\s*(?:n[°.]?\\s*)?${PROT}`, "gi");
    const pulisci = (t) => {
      if (typeof t !== "string" || (!t.includes(PROT) && !t.includes(DEP))) return t;   // gli altri testi restano come sono
      return t.replace(prot, "")
        .replace(new RegExp(`^Depositato presso il Comune di (.+?) il ${DEP}`), `Accordo per il Comune di $1 ${firma}`)
        .replace(new RegExp(`depositato il ${DEP} presso il Comune di`, "g"), `${firma}, per il Comune di`)
        .replace(new RegExp(`depositato il ${DEP}`, "g"), firma)
        .replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").trim();
    };
    const toglie = (e) => e && typeof e === "object" && typeof e.testo === "string" &&
      ((e.testo.includes(PROT) && pulisci(e.testo) === "") || /^quale allegato dell'accordo sottoscritto il /.test(e.testo));
    const sistema = (x) => {
      if (!x || typeof x !== "object") return x;
      if (Array.isArray(x)) return x.filter((e) => !toglie(e)).map(sistema);
      const out = {};
      for (const [k, val] of Object.entries(x)) out[k] = k === "testo" ? pulisci(val) : sistema(val);
      return out;
    };
    const fuori = sistema(blocchi);
    const s = JSON.stringify(fuori);
    if (s.includes(PROT) || s.includes(DEP)) throw new Error("estremi dell'accordo rimasti nel contratto");
    return fuori;
  }

  return { genera, scadenza, conRecesso, breveSenzaObbligo, fineTransitorio, inizioGiorni, canoneTransitorio, giornoPagamento, termineRata, MODELLI, persona, immobile };
});

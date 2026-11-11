/*
 * La scheda del canone su LocaOnLine (dal portale UPPI, senza salvataggio:
 * i dati restano nel browser). Legge il modulo, chiede il calcolo a Canone
 * (canone.js) e scrive le proposte nei campi non modificati a mano. I campi "proposti" (superficie convenzionale di ogni riga, valore
 * al mq) si possono correggere: da quel momento restano come scritti, finche'
 * non si preme "proposta".
 */
(function () {
  "use strict";
  const modulo = document.getElementById("scheda-canone");
  const $ = (sel) => modulo.querySelector(sel);
  const campo = (nome) => modulo.elements[nome];
  const v = (n, c = 2) => Canone.virgola(n, c);
  const euro = (n) => (n === null || n === undefined ? "—" : "€ " + v(n));
  let accordo = null, ultimo = null;

  // ------------------------------------------------------------- costruzione

  function costruisciParametri() {
    const box = document.getElementById("parametri");
    box.innerHTML = accordo.parametri.map((p, i) =>
      `<label><input type="checkbox" name="parametro" value="${i}"> <span class="n">${i + 1}</span> ${p}</label>`).join("");
  }

  function costruisciSuperfici(zona) {
    const tbody = document.getElementById("righe-superficie");
    const prima = leggiSuperfici();
    tbody.innerHTML = Canone.righeSuperficie(accordo, zona).map((r) => `
      <tr data-riga="${r.chiave}">
        <th scope="row">${r.etichetta}</th>
        <td><input type="text" class="campo-numero netta" inputmode="decimal" aria-label="${r.etichetta}, superficie netta"></td>
        <td class="coeff">${r.coeff}</td>
        <td><input type="text" class="campo-numero applicata" inputmode="decimal" aria-label="${r.etichetta}, superficie convenzionale">
          <button type="button" class="ripristina" hidden title="Torna alla superficie proposta">↺</button></td>
      </tr>
      <tr class="nota-riga" data-nota="${r.chiave}"><td colspan="4">${r.nota}</td></tr>`).join("");
    scriviSuperfici(prima);
  }

  // --------------------------------------------------------------- lettura

  function leggiSuperfici() {
    const out = {};
    document.querySelectorAll("#righe-superficie tr[data-riga]").forEach((tr) => {
      const netta = tr.querySelector(".netta").value.trim(), app = tr.querySelector(".applicata");
      out[tr.dataset.riga] = { netta, applicata: app.dataset.modificato ? app.value.trim() : "" };
    });
    return out;
  }

  function scriviSuperfici(sup) {
    document.querySelectorAll("#righe-superficie tr[data-riga]").forEach((tr) => {
      const s = (sup || {})[tr.dataset.riga];
      if (!s) return;
      tr.querySelector(".netta").value = s.netta || "";
      const app = tr.querySelector(".applicata");
      if (s.applicata !== "" && s.applicata !== undefined && s.applicata !== null) {
        app.value = s.applicata; app.dataset.modificato = "1";
      }
    });
  }

  function leggi() {
    const tipo = modulo.querySelector("input[name=tipo]:checked").value;
    const casella = (n) => !!(campo(n) && campo(n).checked);
    const parametri = accordo.parametri.map((_, i) => !!modulo.querySelector(`input[name=parametro][value="${i}"]:checked`));
    const valore = document.getElementById("valore-mq");
    return {
      tipo, durata_anni: Number(campo("durata_anni").value), transitorio_percento: campo("transitorio_percento").value,
      locatore: campo("locatore").value.trim(), conduttore: campo("conduttore").value.trim(),
      citta: campo("citta").value.trim(), indirizzo: campo("indirizzo").value.trim(), zona: campo("zona").value,
      catasto: { foglio: campo("foglio").value.trim(), particella: campo("particella").value.trim(), subalterno: campo("subalterno").value.trim() },
      superfici: leggiSuperfici(),
      caratteristiche: { idrica: casella("idrica"), fognante: casella("fognante"), gas: casella("gas"), riscaldamento: casella("riscaldamento") },
      parametri,
      maggiorazioni: { ammobiliato: campo("ammobiliato").value.trim(), seminterrato: casella("seminterrato"),
        senza_ascensore: casella("senza_ascensore"), attico: casella("attico"), classe_ABC: casella("classe_ABC"),
        eco_bonus: casella("eco_bonus"), sisma_bonus: casella("sisma_bonus"), classe_DEF: casella("classe_DEF") },
      valore_mq: valore.dataset.modificato ? valore.value.trim() : "",
      canone_pattuito: campo("canone_pattuito").value.trim(), storico: casella("storico"),
    };
  }

  /** Rimette nel modulo una scheda salvata (con l'accordo gia' caricato). */
  function carica(d) {
    if (!d || !Object.keys(d).length || !accordo) return;
    modulo.reset();
    campo("zona").value = "";
    document.getElementById("zona-scelta").innerHTML = "";
    costruisciSuperfici(null);
    delete document.getElementById("valore-mq").dataset.modificato;
    const tipo = modulo.querySelector(`input[name=tipo][value="${d.tipo}"]`);
    if (tipo) tipo.checked = true;
    const testo = { durata_anni: d.durata_anni, transitorio_percento: d.transitorio_percento, locatore: d.locatore,
      conduttore: d.conduttore, citta: d.citta, indirizzo: d.indirizzo, foglio: (d.catasto || {}).foglio,
      particella: (d.catasto || {}).particella, subalterno: (d.catasto || {}).subalterno,
      ammobiliato: (d.maggiorazioni || {}).ammobiliato, canone_pattuito: d.canone_pattuito };
    for (const [k, val] of Object.entries(testo)) if (val !== undefined && val !== null && campo(k)) campo(k).value = val;
    campo("storico").checked = !!d.storico;
    for (const k of ["idrica", "fognante", "gas", "riscaldamento"]) campo(k).checked = !!(d.caratteristiche || {})[k];
    for (const k of ["seminterrato", "senza_ascensore", "attico", "classe_ABC", "eco_bonus", "sisma_bonus", "classe_DEF"])
      campo(k).checked = !!(d.maggiorazioni || {})[k];
    (d.parametri || []).forEach((on, i) => {
      const c = modulo.querySelector(`input[name=parametro][value="${i}"]`);
      if (c) c.checked = !!on;
    });
    if (d.zona) scegliZona(d.zona, false);
    scriviSuperfici(d.superfici);
    if (d.valore_mq) { const c = document.getElementById("valore-mq"); c.value = d.valore_mq; c.dataset.modificato = "1"; }
    ricalcola();
  }

  // ------------------------------------------------------------------ zona

  function scegliZona(codice, aggiorna = true) {
    const z = Canone.zona(accordo, codice);
    if (!z) return;
    campo("zona").value = z.codice;
    document.getElementById("cerca-zona").value = "";
    document.getElementById("risultati-zona").hidden = true;
    document.getElementById("zona-scelta").innerHTML =
      `<b>${z.codice}</b> ${z.nome} <span class="macro">${z.macrozona}</span> · oscillazione ${v(z.oscillazione[0])} – ${v(z.oscillazione[1])} €/mq` +
      ` <button type="button" class="annulla-consegna" id="cambia-zona">cambia</button>`;
    costruisciSuperfici(z);
    if (aggiorna) ricalcola();
  }

  function cercaZona() {
    const testo = document.getElementById("cerca-zona").value;
    const box = document.getElementById("risultati-zona");
    if (!testo.trim()) { box.hidden = true; return; }
    const trovate = Canone.cercaZone(accordo, testo, 12);
    box.innerHTML = trovate.length
      ? trovate.map((z) => `<button type="button" role="option" data-codice="${z.codice}"><b>${z.codice}</b> ${z.nome}
          <small>${z.macrozona} · ${v(z.oscillazione[0])} – ${v(z.oscillazione[1])}</small></button>`).join("")
      : '<p class="nessuna">Nessuna zona: prova con il codice o con un\'altra parola.</p>';
    box.hidden = false;
  }

  // -------------------------------------------------------------- calcolo

  function ricalcola() {
    if (!accordo) return;
    const scheda = leggi();
    const r = Canone.calcola(accordo, scheda);
    ultimo = { scheda, r };
    // superfici: le proposte nei campi non modificati
    for (const riga of r.righe) {
      const tr = document.querySelector(`#righe-superficie tr[data-riga="${riga.chiave}"]`);
      if (!tr) continue;
      const s = r.superfici[riga.chiave], app = tr.querySelector(".applicata"), rip = tr.querySelector(".ripristina");
      if (!app.dataset.modificato) app.value = s.proposta === null ? "" : v(s.proposta);
      app.classList.toggle("modificata", !!app.dataset.modificato);
      rip.hidden = !app.dataset.modificato;
      rip.title = s.proposta === null ? "" : `Torna alla proposta: ${v(s.proposta)} mq`;
    }
    document.getElementById("totale-mq").textContent = r.totale ? v(r.totale) : "—";
    document.getElementById("normale").textContent = r.normale ? "SÌ" : "NO";
    document.getElementById("conta-parametri").textContent = `· ${r.parametri} su ${accordo.parametri.length}`;
    const mr = accordo.regole.maggiorazioni;
    document.getElementById("nota-arredo").textContent = scheda.tipo === "studenti"
      ? `per gli studenti ${mr.ammobiliato_studenti}%, con wi-fi e arredi per ogni studente` : `fino al ${mr.ammobiliato_massimo}%`;
    modulo.classList.toggle("tipo-agevolato", scheda.tipo === "agevolato");
    modulo.classList.toggle("tipo-transitorio", scheda.tipo === "transitorio");

    const z = r.zona;
    document.getElementById("esito-zona").textContent = z ? `${z.codice} · ${z.nome}` : "scegli la zona";
    document.getElementById("esito-oscillazione").textContent = z
      ? `${v(r.oscillazione[0])} / ${v(r.oscillazione[1])} €/mq` + (r.storico_percento ? ` (immobile storico: +${r.storico_percento}%)` : "") : "—";
    document.getElementById("esito-subfascia").textContent = z
      ? `${r.parametri} parametri · subfascia ${r.subfascia} (fascia ${r.fascia_lettera}: ${v(r.fascia[0])} – ${v(r.fascia[1])})` +
        (r.normale ? "" : " · appartamento non normale")
      : "—";
    const valore = document.getElementById("valore-mq");
    if (!valore.dataset.modificato) valore.value = r.valore_proposto === null ? "" : v(r.valore_proposto);
    valore.classList.toggle("modificata", !!valore.dataset.modificato);
    document.querySelector('[data-ripristina="valore_mq"]').hidden = !valore.dataset.modificato;
    document.getElementById("nota-valore").textContent = r.valore_proposto === null ? ""
      : valore.dataset.modificato ? `proposto ${v(r.valore_proposto)}` : "proposto dai parametri";

    document.getElementById("esito-maggiorazioni").textContent = r.maggiorazioni.length
      ? r.maggiorazioni.map((m) => `${m.lettera} ${m.percento > 0 ? "+" : ""}${m.percento}%`).join(", ") +
        (r.maggiorazioni.length > 1 ? ` = ${r.maggiorazioni_percento > 0 ? "+" : ""}${r.maggiorazioni_percento}%` : "") +
        ` → ${v(r.valore_maggiorato)} €/mq` +
        (r.limitato ? ` → ${v(r.valore_applicato)} (limite della zona)` : "")
      : "nessuna";
    document.getElementById("esito-canone").textContent = r.canone_base === null ? "—"
      : `€ ${v(r.valore_applicato)} /mq × ${v(r.totale)} mq = € ${v(r.canone_base)}`;
    document.getElementById("esito-durata").textContent = scheda.tipo === "agevolato" && r.durata_percento
      ? `+${r.durata_percento}% = € ${v(r.canone_durata)}` : "—";
    document.getElementById("esito-transitorio").textContent = scheda.tipo === "transitorio" ? `+${v(r.transitorio_percento, 0)}%` : "—";
    document.getElementById("esito-massimo").textContent = euro(r.canone_massimo);
    document.getElementById("barra-massimo").textContent = euro(r.canone_massimo);
    document.getElementById("avvisi").innerHTML = r.avvisi.map((a) => `<li>${a}</li>`).join("");
  }

  // ---------------------------------------------------------------- eventi

  modulo.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "cerca-zona") { cercaZona(); return; }
    if (t.classList.contains("applicata") || t.id === "valore-mq") {
      if (t.value.trim()) t.dataset.modificato = "1"; else delete t.dataset.modificato;
    }
    ricalcola();
  });
  modulo.addEventListener("change", () => ricalcola());
  modulo.addEventListener("click", (e) => {
    const scelta = e.target.closest("#risultati-zona [data-codice]");
    if (scelta) { scegliZona(scelta.dataset.codice); return; }
    if (e.target.id === "cambia-zona") { document.getElementById("cerca-zona").focus(); return; }
    const rip = e.target.closest(".ripristina");
    if (rip) {
      const c = rip.dataset.ripristina ? document.getElementById("valore-mq") : rip.closest("td").querySelector(".applicata");
      delete c.dataset.modificato; ricalcola();
    }
  });
  document.getElementById("cerca-zona").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const primo = document.querySelector("#risultati-zona [data-codice]");
      if (primo) scegliZona(primo.dataset.codice);
    }
  });

  // ------------------------------------------------------------------ PDF
  // Si crea qui, nel browser: la scheda com'e' adesso sullo schermo.
  let caratteri = null;
  // le citta' con una scheda propria (Milano, Napoli: scheda-milano.js,
  // scheda-napoli.js) si registrano in SchedeCitta: qui si passa a quella attiva
  const milano = () => (window.SchedeCitta || []).find((x) => x.attiva()) || null;
  async function creaPDF() {
    if (milano()) return milano().creaPDF();
    if (window.caricaLibrerie) await window.caricaLibrerie("pdf");
    if (!ultimo || !window.PDFLib || !window.fontkit) throw new Error("la stampa non è ancora pronta, riprova tra un attimo");
    if (!caratteri) {
      const prendi = (f) => fetch(`assets/canone/caratteri/${f}`).then((r) => { if (!r.ok) throw new Error("file mancante: " + f); return r.arrayBuffer(); });
      const [regolare, grassetto, icona] = await Promise.all([prendi("Carlito-Regular.ttf"), prendi("Carlito-Bold.ttf"),
        fetch("assets/canone/icona-locaonline.png").then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null)]);
      caratteri = { regolare, grassetto, icona };
    }
    const scheda = Object.assign({}, ultimo.scheda, { numero_scheda: "" });
    const byte = await CanoneStampa.creaPDF({ PDFLib: window.PDFLib, fontkit: window.fontkit, ...caratteri }, accordo, scheda, ultimo.r);
    return new Blob([byte], { type: "application/pdf" });
  }
  const nomePDF = () => {
    if (milano()) return milano().nomePDF();
    const s = ultimo.scheda;
    return ["Scheda canone", s.locatore || "", s.zona || ""].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, "") + ".pdf";
  };
  document.getElementById("scarica-pdf").addEventListener("click", async () => {
    const stato = document.getElementById("stato-salvataggio");
    traccia("scheda_canone_pdf");
    try {
      const url = URL.createObjectURL(await creaPDF());
      const a = document.createElement("a"); a.href = url; a.download = nomePDF(); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) { stato.textContent = "PDF non creato: " + err.message; }
  });
  document.getElementById("apri-pdf").addEventListener("click", async () => {
    const stato = document.getElementById("stato-salvataggio");
    traccia("scheda_canone_stampa");
    const finestra = window.open("", "_blank");       // subito, prima che il browser la blocchi
    try {
      const url = URL.createObjectURL(await creaPDF());
      if (finestra) finestra.location.href = url; else window.location.href = url;
    } catch (err) { if (finestra) finestra.close(); stato.textContent = "PDF non creato: " + err.message; }
  });

  // ---------------------------------------------------------------- avvio
  // L'accordo lo carica la pagina (pagina-canone.js) e lo annuncia con
  // l'evento "accordo": a ogni cambio di comune la scheda riparte da capo.

  function traccia(evento) {
    try { if (window.gtag) gtag("event", evento, { comune: accordo ? accordo.accordo.comune : "" }); } catch (e) { /* mai bloccare */ }
  }

  window.addEventListener("accordo", (e) => {
    // un accordo con un suo "modello" (Milano) ha la sua scheda: questa si nasconde
    if (e.detail.accordo.modello) { accordo = null; ultimo = null; modulo.hidden = true; return; }
    modulo.hidden = false;
    accordo = e.detail;
    costruisciParametri();
    campo("zona").value = "";
    document.getElementById("zona-scelta").innerHTML = "";
    costruisciSuperfici(null);
    campo("citta").value = (accordo.accordo.comune || "").toUpperCase();
    // le percentuali scritte accanto alle caselle vengono dall'accordo
    const segno = (n) => (n > 0 ? "+" : "\u2212") + Math.abs(n) + "%";
    document.querySelectorAll("#scheda-canone [data-perc]").forEach((el) => {
      const n = accordo.regole.maggiorazioni[el.dataset.perc];
      el.textContent = n === undefined ? "" : segno(n);
    });
    // le durate del 3+2: "4 + 2 anni (+7%)" (dentro un <option> niente <span>)
    [...campo("durata_anni").options].forEach((op) => {
      const anni = Number(op.value), p = Canone.percentualeDurata(accordo, anni);
      op.textContent = `${anni} + 2 anni${anni >= 6 ? " o più" : ""}${p ? ` (+${p}%)` : ""}`;
    });
    if (accordo.esempio_zona) document.getElementById("esempio-zona").textContent = accordo.esempio_zona;
    // immobili storici: la casella solo se l'accordo prevede l'aumento delle fasce
    const storici = accordo.regole.storici_dlgs42;
    document.getElementById("riga-storico").hidden = !storici;
    document.getElementById("nota-storico").textContent = storici ? `fasce di oscillazione +${storici}%` : "";
    ricalcola();
  });

  window.SchedaCanone = {
    ultimo: () => (milano() ? milano().ultimo() : ultimo),
    accordo: () => (milano() ? milano().accordo() : accordo),
    carica: (d) => (milano() ? milano().carica(d) : carica(d)),
    leggi: () => (milano() ? milano().leggi() : accordo ? leggi() : null),
    // un titolo per l'elenco della dashboard: zona, indirizzo, canone massimo
    titolo: () => {
      if (milano()) return milano().titolo();
      if (!ultimo) return "Scheda del canone";
      const s = ultimo.scheda, r = ultimo.r;
      return [r.zona ? `${r.zona.codice} ${r.zona.nome}` : "Zona da scegliere", s.indirizzo,
              r.canone_massimo ? `max € ${Canone.virgola(r.canone_massimo)}` : ""].filter(Boolean).join(" · ");
    },
  };
})();

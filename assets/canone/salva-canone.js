/*
 * Salvataggio della scheda del canone e del contratto nell'area del
 * cliente (canone-concordato.html). Solo per chi ha un account: chi non
 * ce l'ha passa dal login e torna qui con il lavoro intatto.
 *
 * Firestore: schede_canone e contratti_compilati, un documento per lavoro
 * con i dati compilati in formato testo (JSON). I PDF non si salvano: si
 * ricreano ogni volta dai dati. Le regole sono in firestore.rules.
 *
 *   ?scheda=ID / ?contratto=ID  riapre un lavoro salvato (dalla dashboard)
 *   ?salva=scheda|contratto     rientro dal login: riprende e salva
 */
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, addDoc, updateDoc, serverTimestamp,
         connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyCnSy8XSjZGRC76YDaknvlHphcCVLZOlL0",
  authDomain:        "locaonline-e8157.firebaseapp.com",
  projectId:         "locaonline-e8157",
  storageBucket:     "locaonline-e8157.firebasestorage.app",
  messagingSenderId: "423895184436",
  appId:             "1:423895184436:web:d34d03ebc2f2b916abc661",
};
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const params = new URLSearchParams(location.search);
// Prove sul computer con l'emulatore di Firebase: mai sul sito pubblicato.
if (params.get('emulatore') === '1' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

const $ = (id) => document.getElementById(id);
const RACCOLTE = { scheda: 'schede_canone', contratto: 'contratti_compilati' };
const STATO = { scheda: 'stato-salvataggio', contratto: 'contratto-stato' };
const BOZZA = 'locaonline_canone_bozza';
const ids = { scheda: params.get('scheda'), contratto: params.get('contratto') };
let utente = null;

function messaggio(cosa, testo, ok = false) {
  const el = $(STATO[cosa]);
  el.innerHTML = testo;
  el.classList.toggle('ok', ok);
}

/** L'indirizzo della pagina con i lavori aperti, per ritrovarli dopo un ricaricamento. */
function aggiornaIndirizzo() {
  const u = new URL(location.href);
  u.searchParams.delete('salva');
  for (const cosa of ['scheda', 'contratto']) {
    if (ids[cosa]) u.searchParams.set(cosa, ids[cosa]); else u.searchParams.delete(cosa);
  }
  history.replaceState(null, '', u.pathname + u.search + u.hash);
}

const accesso = (indirizzo) => `login.html?torna=${encodeURIComponent(indirizzo)}`;

function aggiornaAccount() {
  const el = $('stato-account');
  el.innerHTML = utente
    ? `<i class="fa-solid fa-circle-user mr-1"></i> Sei entrato come <strong>${(utente.email || 'utente').replace(/</g, '&lt;')}</strong>:
       con <strong>Salva</strong> ritrovi scheda e contratto nella tua <a href="dashboard.html" class="text-[#2E7CF6] underline">area riservata</a>.`
    : `<i class="fa-regular fa-floppy-disk mr-1"></i> Vuoi riprendere il lavoro più tardi?
       <a href="${accesso('canone-concordato.html')}" class="text-[#2E7CF6] underline">Accedi o crea un account gratuito</a> e salvalo nella tua area.`;
  el.hidden = false;
}

/** Cosa si salva: i dati del modulo, un titolo per l'elenco, il tipo. */
function raccogli(cosa) {
  if (cosa === 'scheda') {
    const dati = window.SchedaCanone.leggi();
    return { dati, titolo: window.SchedaCanone.titolo(), tipo: dati ? dati.tipo : '' };
  }
  const dati = window.ModuloContratto.leggi();
  return { dati, titolo: window.ModuloContratto.titolo(), tipo: dati.tipo };
}

async function salva(cosa) {
  const accordo = window.SchedaCanone.accordo();
  if (!accordo) { messaggio(cosa, 'Attendi il caricamento dell\'accordo e riprova.'); return; }
  if (!utente) {
    // Senza account: il lavoro resta in questa scheda del browser mentre si
    // passa dal login, e si salva al ritorno.
    try {
      sessionStorage.setItem(BOZZA, JSON.stringify({
        accordo: accordo.accordo.codice, passo: window.PaginaCanone.passo(), ids,
        scheda: window.SchedaCanone.leggi(), contratto: window.ModuloContratto.leggi(),
      }));
    } catch (e) { /* senza sessionStorage si accede comunque, ma il lavoro va rifatto */ }
    window.PaginaCanone.segnaSalvato();
    location.href = accesso(`canone-concordato.html?salva=${cosa}`);
    return;
  }
  const r = raccogli(cosa);
  const dati = JSON.stringify(r.dati);
  if (dati.length > 200000) { messaggio(cosa, 'Troppo lungo per essere salvato: accorcia le altre clausole.'); return; }
  const campi = {
    userId: utente.uid, accordo: accordo.accordo.codice, comune: accordo.accordo.comune || '',
    tipo: r.tipo || '', titolo: (r.titolo || '').slice(0, 300), dati, aggiornato: serverTimestamp(),
  };
  messaggio(cosa, 'Salvataggio…');
  try {
    if (ids[cosa]) await updateDoc(doc(db, RACCOLTE[cosa], ids[cosa]), campi);
    else ids[cosa] = (await addDoc(collection(db, RACCOLTE[cosa]), { ...campi, creato: serverTimestamp() })).id;
    aggiornaIndirizzo();
    window.PaginaCanone.segnaSalvato();
    messaggio(cosa, `✓ Salvato nella tua <a href="dashboard.html" class="underline">area riservata</a>`, true);
    try { if (window.gtag) gtag('event', cosa === 'scheda' ? 'scheda_canone_salvata' : 'contratto_salvato'); } catch (e) { /* mai bloccare */ }
  } catch (err) {
    console.error('Salvataggio non riuscito:', err);
    messaggio(cosa, 'Salvataggio non riuscito: riprova tra poco, o scarica il PDF per non perdere il lavoro.');
  }
}

/** Riapre un lavoro salvato: prima l'accordo con cui era stato fatto. */
async function apri(cosa, id) {
  try {
    const snap = await getDoc(doc(db, RACCOLTE[cosa], id));
    if (!snap.exists()) { messaggio(cosa, 'Lavoro salvato non trovato: forse è stato eliminato.'); ids[cosa] = null; aggiornaIndirizzo(); return; }
    const d = snap.data();
    await window.PaginaCanone.scegliAccordo(d.accordo);
    const dati = JSON.parse(d.dati);
    if (cosa === 'scheda') window.SchedaCanone.carica(dati); else window.ModuloContratto.ricarica(dati);
    window.PaginaCanone.segnaSalvato();
    messaggio(cosa, '✓ Aperto dalla tua area riservata: con Salva aggiorni questa copia.', true);
  } catch (err) {
    console.error('Apertura non riuscita:', err);
    messaggio(cosa, 'Non riesco ad aprire il lavoro salvato: ricarica la pagina.');
  }
}

$('salva-scheda').addEventListener('click', () => salva('scheda'));
$('salva-contratto').addEventListener('click', () => salva('contratto'));

let primaVolta = true;
onAuthStateChanged(auth, async (u) => {
  utente = u && !u.isAnonymous ? u : null;
  aggiornaAccount();
  if (!primaVolta) return;
  primaVolta = false;

  // rientro dal login: si rimette il lavoro e si salva
  const daSalvare = params.get('salva');
  let bozza = null;
  try { bozza = JSON.parse(sessionStorage.getItem(BOZZA) || 'null'); sessionStorage.removeItem(BOZZA); } catch (e) { bozza = null; }
  if (daSalvare && bozza && RACCOLTE[daSalvare]) {
    try {
      await window.PaginaCanone.scegliAccordo(bozza.accordo);
      if (bozza.scheda) window.SchedaCanone.carica(bozza.scheda);
      if (bozza.contratto) window.ModuloContratto.ricarica(bozza.contratto);
      Object.assign(ids, bozza.ids || {});
      window.PaginaCanone.mostra(bozza.passo === 'contratto' ? 'contratto' : 'scheda');
      if (utente) await salva(daSalvare);
      else messaggio(daSalvare, 'Lavoro ripreso, ma non risulti entrato: accedi per salvarlo.');
    } catch (err) {
      console.error(err);
      messaggio(daSalvare, 'Non sono riuscito a riprendere il lavoro: ricompilalo e salva di nuovo.');
    }
    aggiornaIndirizzo();
    return;
  }

  // apertura dalla dashboard
  const daAprire = ['scheda', 'contratto'].filter((c) => ids[c]);
  if (!daAprire.length) { aggiornaIndirizzo(); return; }
  if (!utente) {
    for (const c of daAprire) messaggio(c, `Per aprire il lavoro salvato <a href="${accesso('canone-concordato.html' + location.search)}" class="underline">accedi</a>.`);
    return;
  }
  for (const c of daAprire) await apri(c, ids[c]);
  window.PaginaCanone.mostra(daAprire.includes('contratto') ? 'contratto' : 'scheda');
});

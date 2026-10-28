// Strichcode mit der Kamera von Handy oder Tablet scannen – Pflichtenheft Kap. 4, KANN-Anforderung
// „Inventur mit Strichcode-Scanner“. Wird nur auf der Seite „Inventur – Raum“ geladen.
//
// Verwendet die Strichcode-Erkennung, die im Browser eingebaut ist (BarcodeDetector). Die gibt es z. B. in
// Chrome auf Android-Handys, aber nicht in jedem Browser. Fehlt sie, bleibt der Knopf unsichtbar und man tippt
// die Nummer ein oder verwendet einen Handscanner. Die Kamera funktioniert nur über HTTPS (oder localhost).

const knopf = document.querySelector('[data-kamera-scannen]');
const video = document.querySelector('#kamera');
const feld = document.querySelector('#inventarnummer');
let strom = null; // das Kamerabild, solange die Kamera läuft

if (knopf && 'BarcodeDetector' in window) {
  knopf.hidden = false;
  knopf.addEventListener('click', () => {
    if (sessionStorage.getItem('kamera') === 'an') kameraAus();
    else kameraStarten();
  });
  // Nach jedem Erfassen lädt die Seite neu. War die Kamera an, geht sie gleich wieder an.
  if (sessionStorage.getItem('kamera') === 'an') kameraStarten();
}

async function kameraStarten() {
  try {
    // facingMode 'environment' = die Kamera auf der Rückseite
    strom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    sessionStorage.removeItem('kamera');
    alert('Die Kamera konnte nicht gestartet werden. Bitte den Zugriff auf die Kamera erlauben.');
    return;
  }
  sessionStorage.setItem('kamera', 'an');
  knopf.textContent = 'Kamera aus';
  video.srcObject = strom;
  video.hidden = false;
  await video.play();

  const formate = await BarcodeDetector.getSupportedFormats();
  const erkennung = new BarcodeDetector({ formats: formate });

  // Fünfmal pro Sekunde nachsehen, ob ein Strichcode im Bild ist
  async function suchen() {
    if (!strom) return;
    const codes = await erkennung.detect(video).catch(() => []);
    if (codes.length > 0) {
      feld.value = codes[0].rawValue;
      strom.getTracks().forEach((spur) => spur.stop());
      feld.form.submit(); // wie Enter drücken
      return;
    }
    setTimeout(suchen, 200);
  }
  suchen();
}

function kameraAus() {
  sessionStorage.removeItem('kamera');
  if (strom) strom.getTracks().forEach((spur) => spur.stop());
  strom = null;
  video.hidden = true;
  knopf.textContent = 'Mit Kamera scannen';
}

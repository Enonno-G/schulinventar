# Der Code einfach erklärt

Diese Seite ist für alle, die noch nie mit Node.js gearbeitet haben. Sie erklärt, wie die App aufgebaut ist, wo was
liegt und wie man etwas ändert. Man muss nicht jede Zeile verstehen, um mitzuarbeiten.

## 1. So kommst du rein

1. **Docker Desktop starten** und warten, bis unten links „Engine running“ steht.
2. In VS Code den Ordner `C:\Projekte\schulinventar` öffnen, dann _Terminal → New Terminal_ und eingeben:

   ```bash
   docker compose up -d
   ```

3. Im Browser <http://localhost:3000> öffnen und anmelden:
   - **Administrator:** E-Mail und Passwort stehen in der Datei `.env` bei `ADMIN_EMAIL` und `ADMIN_PASSWORD`.
   - **Testbenutzer**, einer je Rolle: `admin@test.local`, `rechnungswesen@test.local`, `facility@test.local`,
     `lesen@test.local`. Das Passwort steht in `.env` bei `SEED_PASSWORD`.

Probier alle vier Rollen aus: Je nach Rolle sieht man andere Menüpunkte und Knöpfe.

## 2. Das große Bild

```text
   Browser                          Server (Node.js)                         Datenbank (PostgreSQL)
 ┌──────────────┐  1. Adresse     ┌──────────────────────────────┐  2. SQL   ┌──────────────────┐
 │              │  /raeume/5      │ src/seiten/raeume.js         │ ────────► │ Tabelle raeume   │
 │  zeigt die   │ ──────────────► │   holt den Raum              │           │ Tabelle geraete  │
 │  fertige     │                 │                              │ ◄──────── │                  │
 │  HTML-Seite  │ ◄────────────── │ views/raeume/detail.ejs      │  3. Zeilen└──────────────────┘
 │              │  4. HTML-Seite  │   füllt die Vorlage aus      │
 └──────────────┘                 └──────────────────────────────┘
```

Jede Seite entsteht in vier Schritten:

1. Der Browser ruft eine **Adresse** auf, z. B. `/raeume/5`.
2. Eine **Funktion** in `src/seiten/` holt mit SQL die Daten aus der Datenbank.
3. Die Daten werden in eine **Vorlage** aus `views/` eingesetzt. Das ist HTML mit Platzhaltern.
4. Der Server schickt die fertige **HTML-Seite** an den Browser.

Formulare funktionieren genauso, nur umgekehrt: Der Browser schickt die Eingaben an eine Adresse, die Funktion
prüft und speichert sie und leitet dann auf eine andere Seite weiter.

## 3. Ein Beispiel Schritt für Schritt: „Raum anzeigen“

Wer `/raeume/5` aufruft, landet in [`src/seiten/raeume.js`](../src/seiten/raeume.js) bei dieser Funktion
(die Kommentare hinter `//` sind hier zur Erklärung ergänzt):

```js
router.get('/raeume/:id', async (req, res) => {
  // „Wenn jemand /raeume/<etwas> aufruft …“
  const raum = await db.eine('SELECT * FROM raeume WHERE id = $1', [nummer(req.params.id)]);
  if (!raum) return nichtGefunden(res, 'Raum'); // gibt es nicht → Seite „Raum nicht gefunden“

  const geraete = await db.alle(
    `SELECT id, inventarnummer, bezeichnung, typ, seriennummer, garantie_bis
     FROM geraete WHERE raum_id = $1 ORDER BY inventarnummer`,
    [raum.id],
  );
  res.render('raeume/detail', { raum, geraete }); // Vorlage views/raeume/detail.ejs füllen und schicken
});
```

- `req` (request = Anfrage) enthält alles, was der Browser geschickt hat. `req.params.id` ist die `5` aus der Adresse.
- `res` (response = Antwort) ist das, was zurückgeht. `res.render(…)` füllt eine Vorlage aus.
- `db.eine(…)` holt **eine** Zeile, `db.alle(…)` **alle** passenden Zeilen. Das `$1` ist ein Platzhalter, der echte
  Wert steht in der Liste `[…]` dahinter.

Die Vorlage [`views/raeume/detail.ejs`](../views/raeume/detail.ejs) ist normales HTML:

```ejs
<h1>Raum <%= raumName(raum.nummer, raum.bezeichnung) %></h1>

<% for (const geraet of geraete) { %>
  <tr>
    <td><a href="/geraete/<%= geraet.id %>"><%= geraet.inventarnummer %></a></td>
    <td><%= geraet.bezeichnung %></td>
  </tr>
<% } %>
```

- `<%= … %>` setzt einen Wert ein. Sonderzeichen wie `<` werden dabei unschädlich gemacht, damit niemand über ein
  Eingabefeld Code in die Seite schmuggeln kann.
- `<% … %>` ist ein Stück JavaScript ohne Ausgabe, hier eine Schleife: Für jedes Gerät entsteht eine Tabellenzeile.
- `<%- include('../teile/kopf', …) %>` fügt den Seitenkopf mit dem Menü ein (steht ganz oben in jeder Vorlage).

## 4. Ein Formular Schritt für Schritt: „Raum anlegen“

1. **Formular anzeigen:** `GET /raeume/neu` zeigt [`views/raeume/formular.ejs`](../views/raeume/formular.ejs). Darin
   steht `<form method="post" action="/raeume/neu">` mit Eingabefeldern wie `<input name="nummer">`.
2. **Abschicken:** Der Browser schickt die Eingaben an `POST /raeume/neu`. Im Code stehen sie dann in
   `req.body.nummer`, `req.body.bezeichnung` usw.
3. **Darf die Person das?** `nurMitRecht('raeume_bearbeiten')` prüft die Rolle (siehe
   [`src/anmeldung.js`](../src/anmeldung.js)). Ohne Recht kommt die Seite „Kein Zugriff“.
4. **Prüfen:** `raumAusFormular(req.body)` prüft die Eingaben, z. B. ob die Raumnummer ausgefüllt ist und ob es sie
   schon gibt. Bei Fehlern wird das Formular mit roten Hinweisen neben den Feldern noch einmal gezeigt.
5. **Speichern:** In `db.transaktion(…)` wird der Raum gespeichert **und** ein Eintrag ins Änderungsprotokoll
   geschrieben. Transaktion heißt: entweder beides oder gar nichts.
6. **Weiterleiten:** `req.session.meldung = '…'` merkt sich eine grüne Erfolgsmeldung, `res.redirect('/raeume')` schickt
   den Browser zur Raumliste, wo die Meldung einmal angezeigt wird.

Fast jede Funktion der App läuft nach diesem Muster ab. Wer das einmal verstanden hat, findet sich überall zurecht.

### Sonderfall: Formular mit Datei („Beleg hochladen“)

Ein Formular mit Datei braucht im HTML `enctype="multipart/form-data"`, sonst schickt der Browser nur den Dateinamen.
Solche Formulare packt das Paket **multer** aus. In [`src/seiten/belege.js`](../src/seiten/belege.js) steht dafür
`dateiEmpfangen('datei')` vor der Funktion. Danach liegt die Datei in `req.file`, die anderen Felder wie gewohnt in
`req.body`. Was dann passiert, steht in [`src/dateien.js`](../src/dateien.js):

1. **Prüfen:** Endet der Name auf `.pdf`, `.jpg`, `.jpeg` oder `.png`? Und beginnt der Inhalt wirklich so, wie eine
   solche Datei beginnt (eine PDF immer mit `%PDF`)? So fällt auch eine umbenannte `.exe`-Datei auf.
2. **Speichern:** unverändert im Ordner `uploads/`, unter einem zufälligen Namen. Dazu eine **Prüfsumme**, eine Art
   Fingerabdruck der Datei: Ändert sich auch nur ein Zeichen, ändert sich die Prüfsumme.
3. **Eintragen:** In der Tabelle `belege` stehen Art, Originalname und Prüfsumme, in `geraet_belege` die Geräte, zu
   denen der Beleg gehört. So kann eine Rechnung zu 20 PCs gehören.

## 5. Wo liegt was?

| Datei / Ordner               | Was drin ist                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `src/seiten/geraete.js`      | alles zu Geräten: Liste, Suche, Anzeigen, Anlegen, Bearbeiten, CSV-Export     |
| `src/seiten/raeume.js`       | alles zu Räumen                                                               |
| `src/seiten/belege.js`       | Rechnungen, Lieferscheine, Garantiedokumente hochladen und Geräten zuordnen   |
| `src/seiten/export.js`       | Seite „Export“ mit den Links zu den CSV-Dateien                               |
| `src/seiten/benutzer.js`     | Benutzerverwaltung (nur Administrator)                                        |
| `src/seiten/anmelden.js`     | Anmelden, Abmelden, Passwort ändern                                           |
| `src/seiten/geplant.js`      | Platzhalter für Import, Inventur, Soll-Ist – mit Beschreibung, was dort kommt |
| `src/dateien.js`             | hochgeladene Dateien prüfen (nur PDF, JPG, PNG) und speichern                 |
| `src/csv.js`                 | Listen in eine CSV-Datei für Excel umwandeln                                  |
| `views/…`                    | die zugehörigen Vorlagen, z. B. `views/geraete/liste.ejs`                     |
| `views/teile/kopf.ejs`       | Kopf jeder Seite mit dem **Menü**                                             |
| `public/style.css`           | Aussehen: Farben, Abstände, Handy-Ansicht                                     |
| `src/anmeldung.js`           | Rollen und **wer was darf**                                                   |
| `src/app.js`                 | welche Adresse wohin führt, Sicherheit, Sitzungen                             |
| `src/datenbank.js`           | Verbindung zur Datenbank (`db.eine`, `db.alle`, `db.transaktion`)             |
| `datenbank/001_tabellen.sql` | Aufbau aller Tabellen                                                         |
| `src/testdaten.js`           | Testdaten                                                                     |
| `test/`                      | automatische Tests                                                            |
| `.env`                       | Passwörter und Einstellungen (nur auf deinem Rechner, nicht auf GitHub)       |

## 6. JavaScript in fünf Minuten

Mehr braucht man für diesen Code nicht:

```js
const name = 'E.01'; // const = ein Wert mit Namen, der sich nicht mehr ändert
let seite = 1; // let = ein Wert, der sich ändern darf
seite = seite + 1;

const raum = { nummer: 'E.01', stockwerk: 'Erdgeschoß' }; // Objekt: mehrere Werte mit Namen
console.log(raum.nummer); // 'E.01'

const typen = ['PC', 'Beamer', 'Drucker']; // Liste (Array)
for (const typ of typen) {
  // für jeden Eintrag der Liste …
  console.log(typ);
}

if (!raum.nummer) {
  // ! heißt „nicht“: wenn keine Nummer da ist …
  console.log('Pflichtfeld');
}

const text = `Raum ${raum.nummer}`; // Text mit eingesetztem Wert (Backticks `, nicht ')

function raumName(nummer, bezeichnung) {
  // eine Funktion: bekommt Werte, gibt etwas zurück
  return nummer + ' – ' + bezeichnung;
}

const raeume = await db.alle('SELECT * FROM raeume'); // await = warten, bis die Datenbank geantwortet hat
// (geht nur in Funktionen mit async davor)
```

- `null` heißt „kein Wert“ (z. B. leeres Feld). `undefined` heißt „gibt es nicht“.
- `===` vergleicht, `=` weist zu.
- `import … from …` holt Funktionen aus einer anderen Datei, `export` macht sie für andere Dateien verfügbar.

## 7. Begriffe

| Begriff                | Bedeutung                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| **Node.js**            | lässt JavaScript außerhalb des Browsers laufen, hier als Server                           |
| **Express**            | Baukasten für Web-Server: „bei dieser Adresse diese Funktion ausführen“                   |
| **Route**              | eine Adresse mit ihrer Funktion, z. B. `router.get('/raeume', …)`                         |
| **GET / POST**         | GET = Seite abrufen, POST = Formular abschicken                                           |
| **Vorlage (EJS)**      | HTML-Datei mit Platzhaltern, die der Server mit Daten füllt                               |
| **Sitzung / Cookie**   | nach der Anmeldung merkt sich der Browser eine Kennung, damit man angemeldet bleibt       |
| **Transaktion**        | mehrere Datenbank-Schritte, die nur gemeinsam gespeichert werden                          |
| **Hash**               | Passwörter werden nicht umkehrbar umgerechnet und nur so gespeichert                      |
| **`$1`, `$2` im SQL**  | Platzhalter. Die Werte gehen getrennt an die Datenbank (Schutz gegen SQL-Injection)       |
| **Statuscode**         | 200 ok, 302 Weiterleitung, 400 Eingabe falsch, 403 keine Berechtigung, 404 nicht gefunden |
| **Docker / Container** | verpackt App und Datenbank, damit sie auf jedem Rechner gleich laufen                     |

## 8. So änderst du etwas

### Einen Text oder das Aussehen ändern

Text in VS Code mit _Strg + Umschalt + F_ im ganzen Projekt suchen, in der `.ejs`-Datei ändern, speichern, Seite im
Browser neu laden. Farben stehen ganz oben in `public/style.css`.

Wichtig: Läuft die App im Docker-Container, sieht man Änderungen erst nach `docker compose up -d --build`. Beim
Entwickeln deshalb besser mit `npm run dev` arbeiten (siehe README), dann reicht Speichern und Neuladen.

### Ein neues Feld beim Gerät, z. B. „Farbe“

1. **Datenbank:** neue Datei `datenbank/002_geraet_farbe.sql` mit `ALTER TABLE geraete ADD COLUMN farbe text;`
2. **Rechte:** in `src/anmeldung.js` bei `ALLE_GERAETEFELDER` `'farbe'` ergänzen.
3. **Speichern:** in `src/seiten/geraete.js`
   - bei `FELDER` `'farbe'` ergänzen,
   - in den beiden SQL-Befehlen `INSERT INTO geraete …` und `UPDATE geraete SET …` die Spalte `farbe` und den Wert
     `geraet.farbe` ergänzen (auf die Nummerierung `$1, $2, …` achten).
4. **Anzeigen:** in `views/geraete/formular.ejs` ein Feld nach dem Muster der anderen einbauen und in
   `views/geraete/detail.ejs` den Wert anzeigen. In `src/format.js` bei `FELDNAMEN` `farbe: 'Farbe'` ergänzen.
5. **Prüfen:** `npm test`, dann im Browser ausprobieren.

### Eine neue Seite

1. In der passenden Datei in `src/seiten/` eine Route ergänzen, z. B.
   `router.get('/garantie', async (req, res) => { … res.render('garantie', { … }); });`
2. Die Vorlage `views/garantie.ejs` anlegen (am einfachsten `views/geplant.ejs` kopieren).
3. Falls sie ins Menü soll: in `views/teile/kopf.ejs` bei `menue` eintragen.

### Wer was darf

Alles in `src/anmeldung.js` bei `RECHTE`. Soll z. B. auch das Rechnungswesen Räume anlegen dürfen, bei
`raeume_bearbeiten` die Rolle `'rechnungswesen'` ergänzen.

## 9. Dem Programm zuschauen

- **Server-Meldungen:** im Terminal von `npm run dev`, oder `docker compose logs -f app`.
- **Werte ansehen:** irgendwo im Code `console.log(raum);` einfügen, dann erscheint der Wert im Terminal.
- **Im Browser:** _F12_ → Reiter _Netzwerk_. Bei jedem Klick sieht man die Adresse und was geschickt wurde.
- **In der Datenbank:** `docker compose exec db psql -U schulinventar` öffnet die Datenbank, dann z. B.
  `SELECT * FROM raeume;` (beenden mit `\q`).

## 10. Für die Diplomarbeit

Gut beschreiben lassen sich:

- der Aufbau in drei Teilen (Bild in Abschnitt 2) und der Ablauf einer Anfrage (Abschnitte 3 und 4),
- das Datenmodell mit Soll- und Ist-Stand ([`datenmodell.md`](datenmodell.md)),
- die Sicherheit: Passwort-Hash, Rechte am Server, Platzhalter gegen SQL-Injection, `<%= %>` gegen eingeschleuste
  Skripte, automatische Abmeldung (README, Abschnitt _Sicherheit_),
- die automatischen Tests, die u. a. die Abnahme-Testfälle T3, T4, T7 und T8 prüfen
  ([`test/app.test.js`](../test/app.test.js)).

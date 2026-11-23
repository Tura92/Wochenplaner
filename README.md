# Wochenplaner

Gemeinsamer Wochenplan für Daniel und Emily. Mobile Web App (PWA), auf dem Handy über
„Zum Home-Bildschirm“ installierbar.

## Funktionen
- **Plan › Tag**: Zeitstrahl mit einer Spalte pro Person. Leere Stelle antippen = neuer Block.
  Block antippen = bearbeiten. Block lange gedrückt halten und ziehen = verschieben
  (auch in die Spalte der anderen Person). Am unteren Rand ziehen = Dauer ändern.
- **Plan › Woche**: ganze Woche auf einen Blick (D = Daniel, E = Emily).
- **Vorwoche übernehmen**: kopiert alle Einträge der Vorwoche in die aktuelle Woche.
- **Summen**: Stunden pro Person und Kategorie für die gewählte Woche.
- **Kategorien**: frei anlegen, umbenennen, Farbe wählen, löschen. Personen umbenennen.

## Technik
- Reines HTML/CSS/JavaScript ohne Build-Schritt, gehostet über GitHub Pages.
- Daten in Supabase (Postgres) mit Login per E-Mail-Link und Live-Synchronisation.
  Schema: `supabase/schema.sql`. Zugriff nur für E-Mails in der Tabelle `members`.
- `config.js` leeren = App speichert nur lokal im Browser (zum Ausprobieren).
- `vendor/supabase.js` ist supabase-js 2.45.4 (MIT), lokal mitgeliefert.

Lokal starten: `python3 -m http.server` im Ordner, dann http://localhost:8000 öffnen.

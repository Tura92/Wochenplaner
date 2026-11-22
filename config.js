// Verbindung zur gemeinsamen Datenbank (Supabase).
// Der Publishable Key ist absichtlich öffentlich: Zugriff auf Daten haben nur
// angemeldete Personen, deren E-Mail in der Tabelle "members" steht (Row Level Security).
// Beide Werte leeren = App speichert nur lokal auf dem Gerät.
window.WP_CONFIG = {
  supabaseUrl: "https://mtdcddvqyuzvezuvuitw.supabase.co",
  supabaseKey: "sb_publishable_kyZyaxBJKx7Mw_ZtmEHc1g_xF4YBp00",
};

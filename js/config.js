// Site configuration.
window.NR_CONFIG = {
  // Data backend:
  //   "local"    – everything is stored in this browser (localStorage). Default, no setup.
  //   "supabase" – real accounts and a real database on Supabase. Follow supabase/SETUP.md.
  backend: "local",
  supabaseUrl: "",      // e.g. https://xyzcompany.supabase.co
  supabaseAnonKey: "",  // public anon key (never put a service-role key here)
  // The official address of the live site. With backend "supabase", citations and exports (BibTeX, RIS, JSON-LD) always point here,
  // whatever address the page was opened at (www, preview URL). In the demo, exports use the current address.
  siteUrl: "https://openfiledrawer.com/",
  // supabase-js is loaded only when backend is "supabase". Pinned version; for production copy the file to js/vendor/ and point `url` there.
  supabaseJs: { url: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js", integrity: "sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok" },

  // Authorship confirmation before a report goes public:
  //   "off" – publish immediately
  //   "pi"  – the group leader(s) (PI) listed on the report must confirm first
  //   "all" – every co-author with an e-mail address must confirm first
  coauthorConfirmation: "pi",

  // The 30-day go/no-go test shown on the staff desk (start date + targets).
  validation: {
    start: "2026-10-06",
    days: 30,
    targets: { datasets: 3, permissions: 3, reports: 2, commitments: 2 }
  },

  // Switch whole areas of the site on/off.
  // products = the Products page, Data and the Enterprise workspace (Research is the rest of the site)
  features: { registry: true, wanted: true, products: true }
};

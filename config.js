// Copyright (c) 2026 David Kerr. All rights reserved.
// Settings for the yard system. One website serves every location.
window.YARD_CONFIG = {
  SUPABASE_URL: "https://znlxxyepjfconvudvxil.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpubHh4eWVwamZjb252dWR2eGlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0ODY1MjQsImV4cCI6MjEwNzA2MjUyNH0.oY9yPFMV4x0_hCUZsaNR39fzI7UuSC_RTzE1ANZS1zA",
  LOCATIONS: [
    { KEY: "mc", NAME: "Mountain Creek", ADDRESS: "5300 Mountain Creek Pkwy, Dallas, TX 75236", PREFIX: "" },
    { KEY: "fm", NAME: "Flower Mound",   ADDRESS: "Flower Mound, TX", PREFIX: "fm" }   // put the full street address here
  ]
};

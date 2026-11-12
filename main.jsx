import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  Utensils, Shell, Truck, Flame, Calendar, Mic,
  Plus, ChevronRight, ArrowLeft, Presentation, Sparkles,
  ExternalLink, Search
} from 'lucide-react';

// Supabase configuratie via Vercel Environment Variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const CATEGORIES = [
  {
    id: 'Hoofdstands',
    title: 'Hoofdstands',
    subtitle: 'Foodtrucks, broodjes, friet, pizza & hoge capaciteit',
    icon: Utensils,
    accent: 'from-amber-500/20 to-amber-900/5 border-amber-500/30 text-amber-400'
  },
  {
    id: 'Oesters',
    title: 'Oesters',
    subtitle: 'Gespecialiseerde oesterbarren & mobiele oesterconcepten',
    icon: Shell,
    accent: 'from-cyan-500/20 to-cyan-900/5 border-cyan-500/30 text-cyan-400'
  },
  {
    id: 'Overige mobiele kleine concepten',
    title: 'Overige mobiele kleine concepten',
    subtitle: 'Compacte kramen, losse specialiteiten & mobiele karren',
    icon: Truck,
    accent: 'from-emerald-500/20 to-emerald-900/5 border-emerald-500/30 text-emerald-400'
  },
  {
    id: 'Late night snack',
    title: 'Late night snack',
    subtitle: 'Eetmuren, snacks & snelle nachtelijke trek',
    icon: Flame,
    accent: 'from-rose-500/20 to-rose-900/5 border-rose-500/30 text-rose-400'
  }
];

const STATUS_OPTIONS = [
  'Benaderd',
  'Kick-off gehad / In gesprek',
  'Wachten op offerte',
  'Offerte binnen'
];

function App() {
  const [vendors, setVendors] = useState([]);
  const [meetingLogs, setMeetingLogs] = useState([]);
  const [vendorFiles, setVendorFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Navigatie: 'dashboard' | 'category' | 'brochure'
  const [view, setView] = useState('dashboard');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedVendorId, setSelectedVendorId] = useState(null);

  // Modi & Modals
  const [presentationMode, setPresentationMode] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showNewVendorModal, setShowNewVendorModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Formulier states
  const [newVendor, setNewVendor] = useState({
    name: '',
    category: 'Hoofdstands',
    status: 'Kick-off gehad / In gesprek',
    contact_person: '',
    general_info: '',
    offering: '',
    experience: ''
  });

  const [newMeeting, setNewMeeting] = useState({
    meeting_date: new Date().toISOString().split('T')[0],
    contact_person: '',
    raw_notes: '',
    next_action_date: '',
    next_action_summary: ''
  });
  const [audioFile, setAudioFile] = useState(null);
  const [docFile, setDocFile] = useState(null);
  const [docType, setDocType] = useState('offerte');
  const [docDetails, setDocDetails] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [weeklyReplyText, setWeeklyReplyText] = useState('');

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [vRes, mRes, fRes] = await Promise.all([
      supabase.from('vendors').select('*').order('updated_at', { ascending: false }),
      supabase.from('meeting_logs').select('*').order('created_at', { ascending: false }),
      supabase.from('vendor_files').select('*').order('created_at', { ascending: false })
    ]);

    if (vRes.data) setVendors(vRes.data);
    if (mRes.data) setMeetingLogs(mRes.data);
    if (fRes.data) setVendorFiles(fRes.data);
    setLoading(false);
  }

  const activeVendor = vendors.find((v) => v.id === selectedVendorId) || null;
  const categoryVendors = vendors.filter((v) => v.category === selectedCategory);

  async function handleUpdateVendor(updatedVendor) {
    setVendors((prev) => prev.map((v) => (v.id === updatedVendor.id ? updatedVendor : v)));
    if (!supabase) return;
    await supabase
      .from('vendors')
      .update({
        ...updatedVendor,
        updated_at: new Date().toISOString()
      })
      .eq('id', updatedVendor.id);
  }

  async function handleCreateVendor(e) {
    e.preventDefault();
    if (!newVendor.name.trim() || !supabase) return;
    const { data, error } = await supabase
      .from('vendors')
      .insert([
        {
          ...newVendor,
          ai_blind_spots: [
            'Op welke grote evenementen of lustra hebben ze eerder gestaan?',
            'Wat is de exacte uitserveersnelheid en capaciteit op piekmomenten?',
            'Welke afspraken volgen voor het volgende contactmoment?'
          ]
        }
      ])
      .select();

    if (!error && data) {
      setVendors([data[0], ...vendors]);
      setShowNewVendorModal(false);
      setNewVendor({
        name: '',
        category: selectedCategory || 'Hoofdstands',
        status: 'Kick-off gehad / In gesprek',
        contact_person: '',
        general_info: '',
        offering: '',
        experience: ''
      });
    }
  }

  async function analyzeWithAI(promptText) {
    if (!geminiApiKey) return null;
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        }
      );
      const result = await response.json();
      const rawJson = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      return rawJson ? JSON.parse(rawJson) : null;
    } catch (err) {
      console.error('AI verwerkingsfout:', err);
      return null;
    }
  }

  async function handleAddMeetingLog(e) {
    e.preventDefault();
    if (!activeVendor || !supabase) return;
    setAiProcessing(true);

    let uploadedAudioUrl = '';
    if (audioFile) {
      const filePath = `audio/${activeVendor.id}-${Date.now()}-${audioFile.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('lustrum-files')
        .upload(filePath, audioFile);
      if (!uploadErr) {
        const { data: publicData } = supabase.storage.from('lustrum-files').getPublicUrl(filePath);
        uploadedAudioUrl = publicData.publicUrl;
      }
    }

    let parsed = {
      summary_offering: newMeeting.raw_notes,
      summary_experience: activeVendor.experience,
      summary_next_steps: newMeeting.next_action_summary || 'Vervolggesprek inplannen',
      updated_general: activeVendor.general_info,
      blind_spots: activeVendor.ai_blind_spots || []
    };

    const aiPrompt = `
      Je bent de zelflerende assistent voor de Lustrum Food Court.
      Analyseer deze nieuwe gespreksnotities voor bedrijf "${activeVendor.name}" (${activeVendor.category}):
      "${newMeeting.raw_notes}"
      Bestaande informatie - Aanbod: "${activeVendor.offering}", Ervaring: "${activeVendor.experience}".
      Geef uitsluitend een JSON-object terug met:
      {
        "summary_offering": "Samenvatting van het aanbod en mogelijkheden uit dit gesprek",
        "summary_experience": "Uitgebreide samenvatting van hun ervaring en eerdere evenementen",
        "summary_next_steps": "Concrete vervolgstap en afspraak",
        "merged_offering": "Gecombineerde complete tekst voor hun brochure onder Aanbod & Mogelijkheden",
        "merged_experience": "Gecombineerde complete tekst voor hun brochure onder Ervaring & Referenties",
        "blind_spots": ["Vraag 1 die nog openstaat voor de volgende meeting", "Vraag 2 die nog ontbreekt"]
      }
    `;

    const aiResult = await analyzeWithAI(aiPrompt);
    if (aiResult) {
      parsed = {
        summary_offering: aiResult.summary_offering || parsed.summary_offering,
        summary_experience: aiResult.summary_experience || parsed.summary_experience,
        summary_next_steps: aiResult.summary_next_steps || parsed.summary_next_steps,
        merged_offering: aiResult.merged_offering || activeVendor.offering,
        merged_experience: aiResult.merged_experience || activeVendor.experience,
        blind_spots: Array.isArray(aiResult.blind_spots) ? aiResult.blind_spots : parsed.blind_spots
      };
    }

    const { data: logData } = await supabase
      .from('meeting_logs')
      .insert([
        {
          vendor_id: activeVendor.id,
          meeting_date: newMeeting.meeting_date,
          contact_person: newMeeting.contact_person || activeVendor.contact_person,
          raw_notes: newMeeting.raw_notes,
          summary_offering: parsed.summary_offering,
          summary_experience: parsed.summary_experience,
          summary_next_steps: parsed.summary_next_steps,
          audio_file_url: uploadedAudioUrl
        }
      ])
      .select();

    if (logData) {
      setMeetingLogs([logData[0], ...meetingLogs]);
    }

    const updatedVendor = {
      ...activeVendor,
      contact_person: newMeeting.contact_person || activeVendor.contact_person,
      offering: parsed.merged_offering || `${activeVendor.offering}\n${newMeeting.raw_notes}`.trim(),
      experience: parsed.merged_experience || activeVendor.experience,
      last_meeting_date: newMeeting.meeting_date,
      last_meeting_summary: parsed.summary_offering.slice(0, 140),
      next_action_date: newMeeting.next_action_date || activeVendor.next_action_date,
      next_action_summary: newMeeting.next_action_summary || parsed.summary_next_steps,
      ai_blind_spots: parsed.blind_spots
    };

    await handleUpdateVendor(updatedVendor);
    setNewMeeting({
      meeting_date: new Date().toISOString().split('T')[0],
      contact_person: '',
      raw_notes: '',
      next_action_date: '',
      next_action_summary: ''
    });
    setAudioFile(null);
    setAiProcessing(false);
  }

  async function handleFileUpload(e) {
    e.preventDefault();
    if (!docFile || !activeVendor || !supabase) return;
    setAiProcessing(true);

    const filePath = `docs/${activeVendor.id}-${Date.now()}-${docFile.name}`;
    const { error: upErr } = await supabase.storage.from('lustrum-files').upload(filePath, docFile);

    if (!upErr) {
      const { data: pub } = supabase.storage.from('lustrum-files').getPublicUrl(filePath);
      const { data: fileRow } = await supabase
        .from('vendor_files')
        .insert([
          {
            vendor_id: activeVendor.id,
            file_name: docFile.name,
            file_type: docType,
            file_url: pub.publicUrl,
            extracted_details: docDetails
          }
        ])
        .select();

      if (fileRow) setVendorFiles([fileRow[0], ...vendorFiles]);

      if (docType === 'offerte' && docDetails) {
        await handleUpdateVendor({
          ...activeVendor,
          status: 'Offerte binnen',
          financial_notes: `${activeVendor.financial_notes ? activeVendor.financial_notes + '\n' : ''}${docDetails}`
        });
      }
    }
    setDocFile(null);
    setDocDetails('');
    setAiProcessing(false);
  }

  async function handleProcessWeeklyReply() {
    if (!weeklyReplyText.trim() || !supabase) return;
    setAiProcessing(true);

    const aiPrompt = `
      Hier is een wekelijkse update van de gebruiker over meerdere bedrijven voor de Lustrum Food Court:
      "${weeklyReplyText}"
      Huidige bedrijven in de database: ${JSON.stringify(
        vendors.map((v) => ({ id: v.id, name: v.name }))
      )}.
      Geef een JSON-object terug met een lijst "updates" voor elk genoemd bedrijf:
      {
        "updates": [
          {
            "id": "exacte UUID van het bedrijf",
            "last_meeting_date": "datum indien genoemd, anders Vandaag",
            "last_meeting_summary": "korte samenvatting van het contact",
            "next_action_date": "datum volgende actie indien genoemd",
            "next_action_summary": "wat is de volgende stap",
            "extra_experience": "eventuele genoemde ervaring op evenementen",
            "extra_offering": "eventuele genoemde details over het aanbod"
          }
        ]
      }
    `;

    const result = await analyzeWithAI(aiPrompt);
    if (result?.updates?.length) {
      for (const u of result.updates) {
        const target = vendors.find((v) => v.id === u.id);
        if (target) {
          await handleUpdateVendor({
            ...target,
            last_meeting_date: u.last_meeting_date || new Date().toISOString().split('T')[0],
            last_meeting_summary: u.last_meeting_summary || target.last_meeting_summary,
            next_action_date: u.next_action_date || target.next_action_date,
            next_action_summary: u.next_action_summary || target.next_action_summary,
            experience: u.extra_experience
              ? `${target.experience}\n${u.extra_experience}`.trim()
              : target.experience,
            offering: u.extra_offering
              ? `${target.offering}\n${u.extra_offering}`.trim()
              : target.offering
          });
        }
      }
    }

    await supabase.from('weekly_checkins').insert([
      {
        user_reply: weeklyReplyText,
        processed_updates: result?.updates || []
      }
    ]);

    setWeeklyReplyText('');
    setAiProcessing(false);
    setShowCheckinModal(false);
    fetchAllData();
  }

  if (!supabase) {
    return (
      <div className="min-h-screen bg-[#090A0F] text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-zinc-900/90 border border-amber-500/30 rounded-2xl p-8 space-y-4">
          <h1 className="text-2xl font-serif-luxury text-amber-400">
            Koppel je Supabase Sleutels in Vercel
          </h1>
          <p className="text-zinc-300 text-sm leading-relaxed">
            De app staat klaar, maar mist nog de verbindingsgegevens van je Supabase-project. Voeg
            de volgende Environment Variables toe in Vercel onder Settings → Environment Variables:
          </p>
          <pre className="bg-black/60 p-4 rounded-xl text-xs text-amber-200 overflow-x-auto border border-zinc-800">
            VITE_SUPABASE_URL=jouw_supabase_project_url{'\n'}
            VITE_SUPABASE_ANON_KEY=jouw_supabase_anon_public_key{'\n'}
            VITE_GEMINI_API_KEY=jouw_gemini_api_key_voor_ai_notulen
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#090A0F]/85 border-b border-zinc-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div
            onClick={() => {
              setView('dashboard');
              setSelectedCategory(null);
              setSelectedVendorId(null);
            }}
            className="cursor-pointer"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-amber-400/90 font-medium">
              Lustrum Food Court Regie
            </span>
            <h1 className="text-2xl font-serif-luxury text-white tracking-tight">
              Overzicht & Interactieve Brochures
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {!presentationMode && (
              <button
                onClick={() => setShowCheckinModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-sm font-medium text-zinc-200 transition"
              >
                <Calendar className="w-4 h-4 text-amber-400" />
                Dinsdagochtend Check-in
              </button>
            )}

            <button
              onClick={() => setPresentationMode(!presentationMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition ${
                presentationMode
                  ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-amber-300 border-amber-500/30'
              }`}
            >
              <Presentation className="w-4 h-4" />
              {presentationMode ? 'Presentatiemodus Actief (CvT)' : 'Presentatiemodus (CvT)'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        {view === 'dashboard' && (
          <>
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Selecteer een Gradatie op de Food Court
                  </h2>
                  <p className="text-sm text-zinc-400">
                    Klik op een segment voor het vergelijkingsoverzicht en de interactieve
                    bedrijfsbrochures.
                  </p>
                </div>
                {!presentationMode && (
                  <button
                    onClick={() => setShowNewVendorModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition"
                  >
                    <Plus className="w-4 h-4" /> Nieuw Bedrijf Toevoegen
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const catVendors = vendors.filter((v) => v.category === cat.id);
                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setView('category');
                      }}
                      className={`group cursor-pointer rounded-2xl bg-gradient-to-br ${cat.accent} bg-zinc-900/60 border p-7 transition-all hover:scale-[1.01] hover:border-amber-400/60`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-semibold opacity-80">
                            <Icon className="w-4 h-4" /> Gradatie
                          </span>
                          <h3 className="text-2xl font-serif-luxury text-white">{cat.title}</h3>
                          <p className="text-sm text-zinc-300/90 max-w-md">{cat.subtitle}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-3xl font-bold text-white">{catVendors.length}</span>
                          <p className="text-xs text-zinc-400">partijen</p>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-zinc-300">
                        <div className="truncate max-w-xs">
                          {catVendors.length > 0
                            ? catVendors.map((v) => v.name).join(' • ')
                            : 'Nog geen partijen toegevoegd'}
                        </div>
                        <span className="inline-flex items-center gap-1 font-medium text-white group-hover:translate-x-1 transition">
                          Open overzicht <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Actueel Gespreksoverzicht & Eerstvolgende Acties
                  </h2>
                  <p className="text-sm text-zinc-400">
                    Direct inzicht in waar je met elk bedrijf staat, het laatste gesprek en het
                    volgende contactmoment.
                  </p>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Zoek bedrijf of ervaring..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400">
                      <th className="py-3 px-4">Bedrijf</th>
                      <th className="py-3 px-4">Gradatie</th>
                      <th className="py-3 px-4">Fase</th>
                      <th className="py-3 px-4">Laatste Meeting & Inhoud</th>
                      <th className="py-3 px-4">Volgend Contactmoment</th>
                      <th className="py-3 px-4 text-right">Brochure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-sm">
                    {vendors
                      .filter(
                        (v) =>
                          v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (v.experience || '').toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((v) => (
                        <tr
                          key={v.id}
                          onClick={() => {
                            setSelectedCategory(v.category);
                            setSelectedVendorId(v.id);
                            setView('brochure');
                          }}
                          className="hover:bg-zinc-800/40 cursor-pointer transition"
                        >
                          <td className="py-3.5 px-4 font-semibold text-white">{v.name}</td>
                          <td className="py-3.5 px-4 text-zinc-300">{v.category}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {v.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="text-xs text-amber-400 font-medium">
                              {v.last_meeting_date || 'Nog geen datum'}
                            </div>
                            <div className="text-zinc-300 truncate">
                              {v.last_meeting_summary || 'Geen samenvatting ingevoerd'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="text-xs text-emerald-400 font-medium">
                              {v.next_action_date || 'Datum plannen'}
                            </div>
                            <div className="text-zinc-300 truncate">
                              {v.next_action_summary || 'Geen vervolgactie ingesteld'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="text-amber-400 hover:underline text-xs font-medium">
                              Open Brochure →
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {view === 'category' && selectedCategory && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <button
                  onClick={() => setView('dashboard')}
                  className="inline-flex items-center gap-2 text-xs text-amber-400 hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Terug naar alle gradaties
                </button>
                <h2 className="text-3xl font-serif-luxury text-white">{selectedCategory}</h2>
                <p className="text-sm text-zinc-400">
                  Gedetailleerde vergelijking van aanbod, ervaring en gespreksstatus binnen dit
                  segment. Klik op een bedrijf voor de volledige interactieve brochure.
                </p>
              </div>

              {!presentationMode && (
                <button
                  onClick={() => {
                    setNewVendor({ ...newVendor, category: selectedCategory });
                    setShowNewVendorModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition"
                >
                  <Plus className="w-4 h-4" /> Partij toevoegen aan {selectedCategory}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {categoryVendors.map((v) => (
                <div
                  key={v.id}
                  onClick={() => {
                    setSelectedVendorId(v.id);
                    setView('brochure');
                  }}
                  className="cursor-pointer bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 rounded-2xl p-6 space-y-5 transition flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {v.status}
                        </span>
                        <h3 className="text-2xl font-serif-luxury text-white mt-2">{v.name}</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Contactpersoon: {v.contact_person || 'Nog niet ingevuld'}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
                        Interactieve Brochure <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-zinc-800/80 text-sm">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold block">
                          Ervaring & Eerdere Evenementen
                        </span>
                        <p className="text-zinc-200 whitespace-pre-line mt-0.5">
                          {v.experience || 'Nog geen ervaring vastgelegd.'}
                        </p>
                      </div>

                      <div>
                        <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold block">
                          Aanbod & Mogelijkheden
                        </span>
                        <p className="text-zinc-300 whitespace-pre-line mt-0.5">
                          {v.offering || 'Nog geen aanboddetails vastgelegd.'}
                        </p>
                      </div>

                      {v.financial_notes && (
                        <div>
                          <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold block">
                            Offertes & Financiële Voorwaarden
                          </span>
                          <p className="text-zinc-300 whitespace-pre-line mt-0.5">
                            {v.financial_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-800/80 grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/60">
                      <span className="text-zinc-400 block">Laatste gesprek:</span>
                      <strong className="text-white block mt-0.5">
                        {v.last_meeting_date || 'Geen datum'}
                      </strong>
                      <span className="text-zinc-400 line-clamp-1">{v.last_meeting_summary}</span>
                    </div>
                    <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/60">
                      <span className="text-zinc-400 block">Volgende actie:</span>
                      <strong className="text-emerald-400 block mt-0.5">
                        {v.next_action_date || 'Plannen'}
                      </strong>
                      <span className="text-zinc-400 line-clamp-1">{v.next_action_summary}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === 'brochure' && activeVendor && (
          <section className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <button
                  onClick={() => setView('category')}
                  className="inline-flex items-center gap-2 text-xs text-amber-400 hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Terug naar vergelijkingsoverzicht (
                  {activeVendor.category})
                </button>
                <div className="flex items-center gap-3 mt-2">
                  <h2 className="text-4xl font-serif-luxury text-white">{activeVendor.name}</h2>
                  <select
                    value={activeVendor.status}
                    disabled={presentationMode}
                    onChange={(e) =>
                      handleUpdateVendor({ ...activeVendor, status: e.target.value })
                    }
                    className="bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded-full px-3 py-1 text-xs font-medium focus:outline-none"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st} className="bg-zinc-900 text-white">
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-5">
                  <h3 className="text-lg font-serif-luxury text-amber-400">
                    Bedrijfsprofiel, Ervaring & Aanbod
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                        Wie zijn ze / Algemene beschrijving
                      </label>
                      <textarea
                        rows={2}
                        readOnly={presentationMode}
                        value={activeVendor.general_info || ''}
                        onChange={(e) =>
                          handleUpdateVendor({ ...activeVendor, general_info: e.target.value })
                        }
                        className="w-full mt-1 bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
                        Ervaring & Eerdere Evenementen (Essentieel voor vergelijking)
                      </label>
                      <textarea
                        rows={4}
                        readOnly={presentationMode}
                        value={activeVendor.experience || ''}
                        onChange={(e) =>
                          handleUpdateVendor({ ...activeVendor, experience: e.target.value })
                        }
                        className="w-full mt-1 bg-zinc-950/80 border border-amber-500/30 rounded-xl p-3 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                        Aanbod, Menu & Mogelijkheden op het Lustrumterrein
                      </label>
                      <textarea
                        rows={4}
                        readOnly={presentationMode}
                        value={activeVendor.offering || ''}
                        onChange={(e) =>
                          handleUpdateVendor({ ...activeVendor, offering: e.target.value })
                        }
                        className="w-full mt-1 bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                          Capaciteit & Logistiek
                        </label>
                        <textarea
                          rows={3}
                          readOnly={presentationMode}
                          value={activeVendor.capacity_logistics || ''}
                          onChange={(e) =>
                            handleUpdateVendor({
                              ...activeVendor,
                              capacity_logistics: e.target.value
                            })
                          }
                          placeholder="Uitserveersnelheid, stroom, afmetingen..."
                          className="w-full mt-1 bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
                          Offertes & Financiële Afspraken (Later stadium)
                        </label>
                        <textarea
                          rows={3}
                          readOnly={presentationMode}
                          value={activeVendor.financial_notes || ''}
                          onChange={(e) =>
                            handleUpdateVendor({
                              ...activeVendor,
                              financial_notes: e.target.value
                            })
                          }
                          placeholder="Wordt gevuld zodra offertes binnenkomen..."
                          className="w-full mt-1 bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-5">
                  <h3 className="text-lg font-serif-luxury text-white">
                    Vastgelegde Gesprekken & Audio-notulen
                  </h3>

                  {!presentationMode && (
                    <form
                      onSubmit={handleAddMeetingLog}
                      className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-4 space-y-4"
                    >
                      <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                        Nieuw gesprek of audiobestand toevoegen (werkt brochure automatisch bij)
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="date"
                          value={newMeeting.meeting_date}
                          onChange={(e) =>
                            setNewMeeting({ ...newMeeting, meeting_date: e.target.value })
                          }
                          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
                        />
                        <input
                          type="text"
                          placeholder="Naam gesprekspartner"
                          value={newMeeting.contact_person}
                          onChange={(e) =>
                            setNewMeeting({ ...newMeeting, contact_person: e.target.value })
                          }
                          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
                        />
                      </div>

                      <textarea
                        rows={3}
                        required
                        placeholder="Plak hier je ruwe aantekeningen of transcriptie van het gesprek (ervaring, aanbod, mogelijkheden)..."
                        value={newMeeting.raw_notes}
                        onChange={(e) =>
                          setNewMeeting({ ...newMeeting, raw_notes: e.target.value })
                        }
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white"
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="date"
                          value={newMeeting.next_action_date}
                          onChange={(e) =>
                            setNewMeeting({ ...newMeeting, next_action_date: e.target.value })
                          }
                          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
                        />
                        <input
                          type="text"
                          placeholder="Vervolgafspraak (bijv. volgende week bellen)"
                          value={newMeeting.next_action_summary}
                          onChange={(e) =>
                            setNewMeeting({ ...newMeeting, next_action_summary: e.target.value })
                          }
                          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-800">
                          <Mic className="w-4 h-4 text-amber-400" />
                          <span>
                            {audioFile ? audioFile.name : 'Optioneel: Koppel audiobestand (mp3/m4a)'}
                          </span>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="submit"
                          disabled={aiProcessing}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition"
                        >
                          {aiProcessing
                            ? 'Bezig met verwerken...'
                            : 'Gesprek Opslaan & Brochure Bijwerken'}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-3">
                    {meetingLogs
                      .filter((m) => m.vendor_id === activeVendor.id)
                      .map((log) => (
                        <div
                          key={log.id}
                          className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 space-y-2 text-sm"
                        >
                          <div className="flex items-center justify-between text-xs text-amber-400">
                            <span>
                              Datum: {log.meeting_date} • Gesprekspartner:{' '}
                              {log.contact_person || 'Onbekend'}
                            </span>
                            {log.audio_file_url && (
                              <a
                                href={log.audio_file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="underline flex items-center gap-1"
                              >
                                Beluister Audio <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <p className="text-zinc-200 whitespace-pre-line">{log.raw_notes}</p>
                          {log.summary_next_steps && (
                            <div className="text-xs text-emerald-400 pt-1">
                              Vervolgafspraak: {log.summary_next_steps}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-semibold text-white">Contact & Gespreksplanning</h3>
                  <div className="space-y-2 text-sm">
                    <input
                      type="text"
                      placeholder="Contactpersoon"
                      readOnly={presentationMode}
                      value={activeVendor.contact_person || ''}
                      onChange={(e) =>
                        handleUpdateVendor({ ...activeVendor, contact_person: e.target.value })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200"
                    />
                    <input
                      type="text"
                      placeholder="Telefoonnummer"
                      readOnly={presentationMode}
                      value={activeVendor.phone || ''}
                      onChange={(e) =>
                        handleUpdateVendor({ ...activeVendor, phone: e.target.value })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200"
                    />
                    <input
                      type="email"
                      placeholder="E-mailadres"
                      readOnly={presentationMode}
                      value={activeVendor.email || ''}
                      onChange={(e) =>
                        handleUpdateVendor({ ...activeVendor, email: e.target.value })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200"
                    />
                  </div>
                </div>

                <div className="bg-gradient-to-b from-amber-500/10 to-zinc-900/90 border border-amber-500/30 rounded-2xl p-6 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                    <Sparkles className="w-4 h-4" />
                    Zelflerende Check: Vragen voor volgend gesprek
                  </div>
                  <ul className="space-y-2 text-xs text-zinc-300 list-disc pl-4">
                    {(activeVendor.ai_blind_spots || []).map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-semibold text-white">
                    Bestanden, Menu's & Offertes
                  </h3>
                  {!presentationMode && (
                    <form onSubmit={handleFileUpload} className="space-y-3 text-xs">
                      <input
                        type="file"
                        onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                        className="w-full text-zinc-400"
                      />
                      <input
                        type="text"
                        placeholder="Belangrijkste prijzen of notities uit dit bestand..."
                        value={docDetails}
                        onChange={(e) => setDocDetails(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white"
                      />
                      <button
                        type="submit"
                        className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-medium"
                      >
                        Bestand Opslaan in Brochure
                      </button>
                    </form>
                  )}

                  <div className="space-y-2">
                    {vendorFiles
                      .filter((f) => f.vendor_id === activeVendor.id)
                      .map((f) => (
                        <a
                          key={f.id}
                          href={f.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 text-xs"
                        >
                          <div className="font-medium text-amber-300">{f.file_name}</div>
                          {f.extracted_details && (
                            <div className="text-zinc-400 mt-1">{f.extracted_details}</div>
                          )}
                        </a>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {showCheckinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-serif-luxury text-amber-400">
                Automatische Dinsdagochtend Check-in
              </h3>
              <button
                onClick={() => setShowCheckinModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Sluiten
              </button>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Typ of spreek hieronder in één bericht je wekelijkse updates in voor alle bedrijven
              die je hebt gesproken. Het systeem splitst je tekst automatisch uit en werkt van elk
              genoemd bedrijf de brochure, laatste meeting en volgende afspraak bij.
            </p>
            <textarea
              rows={6}
              value={weeklyReplyText}
              onChange={(e) => setWeeklyReplyText(e.target.value)}
              placeholder="Bijv: Net met Silty Pleasure gebeld, ze hebben ervaring op grote corpsfeesten en kunnen 400 oesters per uur openen, volgende week donderdag bellen we weer. De Oesterbazen sturen vrijdag hun lijst met eerdere festivals door..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:border-amber-500 focus:outline-none"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={handleProcessWeeklyReply}
                disabled={aiProcessing}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm"
              >
                {aiProcessing
                  ? 'Updates verwerken...'
                  : 'Verwerk Updates Automatisch in Alle Brochures'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewVendorModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateVendor}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4"
          >
            <h3 className="text-xl font-serif-luxury text-white">Nieuw Bedrijf Toevoegen</h3>
            <input
              type="text"
              required
              placeholder="Bedrijfsnaam"
              value={newVendor.name}
              onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
            />
            <select
              value={newVendor.category}
              onChange={(e) => setNewVendor({ ...newVendor, category: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <textarea
              rows={3}
              placeholder="Eerste notities over ervaring en aanbod..."
              value={newVendor.experience}
              onChange={(e) => setNewVendor({ ...newVendor, experience: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowNewVendorModal(false)}
                className="px-4 py-2 text-sm text-zinc-400"
              >
                Annuleren
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-sm"
              >
                Toevoegen
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

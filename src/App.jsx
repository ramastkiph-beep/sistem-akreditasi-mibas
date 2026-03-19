import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  CheckSquare, Square, UploadCloud, ExternalLink, MessageSquare, 
  BookOpen, ShieldCheck, Users, ChevronDown, ChevronUp, Send, 
  Sparkles, Target, FileText, Wand2, Copy, CheckCircle2, Wifi, 
  Loader2, UserCheck, AlertTriangle, Code2, Quote, X, ClipboardList, Download, Bot, Layers, BookMarked, HeartHandshake
} from 'lucide-react';

// --- FIREBASE INITIALIZATION & CONFIG ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- HELPER FUNCTION FOR GEMINI API ---
const fetchWithRetry = async (url, options, retries = 5) => {
  let delay = 1000;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        // Jangan retry jika HTTP Status adalah 400, 401, atau 403 (Klien/Otentikasi error)
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          throw new Error(`HTTP Client Error status: ${res.status}`);
        }
        throw new Error(`HTTP Server/Network error! status: ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (err.message.includes('Client Error')) throw err; // Gagalkan tanpa retry
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
};

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeGenerator, setActiveGenerator] = useState('modul');
  const [expandedButir, setExpandedButir] = useState({});
  
  // State Chat Assistant
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'bot', text: 'Halo Bos! Aku Asisten AI Khusus Akreditasi BAN-PDM 2026. Tanyakan apa saja soal bukti dukung, regulasi madrasah, atau Kurikulum Berbasis Cinta (KBC).' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatContainerRef = useRef(null);

  // Firebase Auth & Realtime State
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [checkedEvidences, setCheckedEvidences] = useState({});

  // State Generator RPP KBC (Simple)
  const [rppForm, setRppForm] = useState({ 
    mapel: '', 
    fase: 'A (Kelas 1-2)', 
    topik: '', 
    tujuan: '', 
    language: 'Indonesia', 
    diferensiasi: { konten: false, proses: false, produk: false } 
  });
  const [generatedRpp, setGeneratedRpp] = useState(null);
  const [isGeneratingRpp, setIsGeneratingRpp] = useState(false);
  const [isCopiedRpp, setIsCopiedRpp] = useState(false);

  // State Generator Modul Ajar Deep Learning + PSE (Bilingual)
  const [modulForm, setModulForm] = useState({
    mapel: '',
    fase: 'A (Kelas 1)',
    topik: '',
    alokasi: '4-6 JP (2-3 kali pertemuan)',
    language: 'Indonesia' // Fitur Bahasa
  });
  const [generatedModul, setGeneratedModul] = useState(null);
  const [isGeneratingModul, setIsGeneratingModul] = useState(false);
  const [isCopiedModul, setIsCopiedModul] = useState(false);

  // State Simulasi Asesor
  const [simulasiForm, setSimulasiForm] = useState({ target: 'Guru', butir: 'b1' });
  const [generatedQuestions, setGeneratedQuestions] = useState(null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);

  // State Generator SOP
  const [sopForm, setSopForm] = useState({ judul: '', konteks: '' });
  const [generatedSop, setGeneratedSop] = useState(null); 
  const [isGeneratingSop, setIsGeneratingSop] = useState(false);

  // --- FIREBASE EFFECTS ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setIsSyncing(false);
      return; 
    }
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'akreditasi_mi_bas', 'checklist_state_v3');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const checks = {};
        for (const key in data) {
          if (!key.endsWith('_link')) checks[key] = data[key];
        }
        setCheckedEvidences(checks);
      } else {
        setCheckedEvidences({});
      }
      setIsSyncing(false); 
    }, (error) => {
      console.error("Firestore sync error:", error);
      setIsSyncing(false);
    });
    
    return () => unsubscribe();
  }, [user]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // --- FUNCTIONS ---
  const toggleEvidence = async (evidenceId) => {
    const newValue = !checkedEvidences[evidenceId];
    setCheckedEvidences(prev => ({ ...prev, [evidenceId]: newValue }));
    if (!user) return; 
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'akreditasi_mi_bas', 'checklist_state_v3');
      await setDoc(docRef, { [evidenceId]: newValue }, { merge: true });
    } catch (error) {
      console.error("Gagal simpan ke cloud:", error);
      setCheckedEvidences(prev => ({ ...prev, [evidenceId]: !newValue }));
    }
  };

  const toggleAccordion = (butirId) => {
    setExpandedButir(prev => ({ ...prev, [butirId]: !prev[butirId] }));
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || isChatLoading) return;
    const userMsg = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY || "ISI_API_KEY_DISINI";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      const systemPrompt = `Kamu adalah Asisten Konsultan Akreditasi BAN-PDM khusus untuk Madrasah Ibtidaiyah (MI BAS International Tuban). 
      Tugas utamamu HANYA menjawab seputar: instrumen akreditasi 2024/2025 (14 Butir), Kurikulum Berbasis Cinta (KBC), Pembelajaran Sosial Emosional (PSE), pembuktian kinerja guru, dan administrasi madrasah.
      Gunakan bahasa yang santai tapi profesional, panggil pengguna dengan sebutan "Bos".
      Beri jawaban yang ringkas, tajam, valid berdasarkan instrumen BAN-PDM, dan langsung pada intinya.`;
      const chatContext = chatHistory.slice(-4).map(msg => ({ role: msg.role === 'bot' ? 'model' : 'user', parts: [{ text: msg.text }] }));
      chatContext.push({ role: 'user', parts: [{ text: userMsg }] });

      const payload = { contents: chatContext, systemInstruction: { parts: [{ text: systemPrompt }] } };
      const data = await fetchWithRetry(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      
      if (data.candidates && data.candidates.length > 0) {
        const botReply = data.candidates[0].content.parts[0].text;
        setChatHistory(prev => [...prev, { role: 'bot', text: botReply }]);
      } else {
        throw new Error("Empty response");
      }
    } catch (error) {
      console.error("AI Chat error:", error);
      setChatHistory(prev => [...prev, { role: 'bot', text: "Waduh Bos, sepertinya jaringanku lagi bermasalah atau kena limit. Coba tanya lagi nanti ya." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const generateSimulasi = () => {
    setIsGeneratingQuestions(true); setGeneratedQuestions(null);
    setTimeout(() => {
      const questionBank = {
        Guru: {
          b1: ["Bagaimana Bapak/Ibu menyisipkan KSE (Keterampilan Sosial Emosional) dalam mengajar?", "Bisa dicontohkan bagaimana Anda memfasilitasi murid mengelola emosinya sebelum belajar dimulai?"],
          b11: ["Apa bedanya RPP biasa dengan RPP Berdiferensiasi yang Bapak/Ibu buat?", "Bagaimana cara memfasilitasi murid yang butuh bimbingan lebih?"],
          default: ["Bagaimana strategi Bapak/Ibu melibatkan siswa agar aktif saat pembelajaran berlangsung?"]
        },
        Kepala_Madrasah: {
          b5: ["Bagaimana mekanisme evaluasi kinerja guru? Ada notulensi tindak lanjutnya?"],
          b12: ["Jika ada kasus perundungan antar siswa, bagaimana alur penanganannya sesuai SOP TPPK?"],
          default: ["Bagaimana strategi memastikan visi madrasah diimplementasikan oleh seluruh GTK?"]
        },
        Murid: {
          b2: ["Adik-adik, siapa yang bikin aturan kelas? Kalian ikut diajak diskusi nggak?"],
          default: ["Belajar di MI BAS ini menyenangkan nggak? Pelajaran apa yang paling seru?"]
        }
      };
      const targetRole = simulasiForm.target === 'Kepala Madrasah' ? 'Kepala_Madrasah' : simulasiForm.target;
      const questions = questionBank[targetRole][simulasiForm.butir] || questionBank[targetRole]['default'];

      setGeneratedQuestions({
        role: simulasiForm.target,
        questions: questions,
        tips: "TIPS BOS: Pastikan tim tidak cuma menghafal. Asesor akan melakukan triangulasi (mengecek kesesuaian antara jawaban lisan dengan dokumen dan realita di lapangan)."
      });
      setIsGeneratingQuestions(false);
    }, 1000);
  };

  const generateRppKBC = async () => {
    if (!rppForm.mapel || !rppForm.topik || !rppForm.tujuan) { 
        alert("Bos, lengkapi semua isian Mapel, Fase, Topik, dan Tujuan!"); 
        return; 
    }
    if (!rppForm.diferensiasi.konten && !rppForm.diferensiasi.proses && !rppForm.diferensiasi.produk) { 
        alert("Pilih minimal 1 jenis diferensiasi untuk RPP Berdiferensiasi!"); 
        return; 
    }
    
    setIsGeneratingRpp(true); 
    setGeneratedRpp(null); 
    setIsCopiedRpp(false);

    const isEng = rppForm.language === 'English';

    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY || "ISI_API_KEY_DISINI";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      let difStr = [];
      if (rppForm.diferensiasi.konten) difStr.push("Diferensiasi Konten / Content Differentiation");
      if (rppForm.diferensiasi.proses) difStr.push("Diferensiasi Proses / Process Differentiation");
      if (rppForm.diferensiasi.produk) difStr.push("Diferensiasi Produk / Product Differentiation");

      const prompt = `Buatkan isi Rencana Pelaksanaan Pembelajaran (RPP) singkat berbasis "Kurikulum Berbasis Cinta (KBC)" dan Pembelajaran Mendalam (Deep Learning) untuk MI.
      Data Materi:
      Mata Pelajaran: ${rppForm.mapel}
      Fase/Kelas: ${rppForm.fase}
      Topik/Bab: ${rppForm.topik}
      Tujuan Pembelajaran: ${rppForm.tujuan}
      Diferensiasi: ${difStr.join(", ")}
      
      PENTING: Bahasa Output yang diminta adalah: ${rppForm.language}. 
      Pastikan SELURUH nilai/values di dalam JSON menggunakan bahasa ${rppForm.language}. Jika bahasa Inggris, terjemahkan istilah P5-PPRA secara natural namun pertahankan konteks nilainya.

      Berikan output JSON dengan field berikut. Gunakan bahasa yang rapi, berpusat pada murid, dan penuh kasih sayang. TULISKAN SECARA SANGAT RINCI, PANJANG LEBAR, DAN KOMPREHENSIF PADA SETIAP BAGIAN PENJELASAN. Gunakan format HTML (seperti <b>, <ul>, <li>, <br>) DI DALAM string value jika perlu list/huruf tebal.
      
      Kunci JSON wajib:
      - pengetahuanAwal: 1 paragraf narasi
      - minat: 1 paragraf narasi
      - kebutuhanBelajar: 1 paragraf narasi
      - pemahamanBermakna: 1 kalimat
      - pertanyaanPemantik: 2-3 pertanyaan (format HTML <ul><li>)
      - pendahuluan: Langkah-langkah awal termasuk KSE/Mindfulness (format HTML <ol><li>)
      - inti: Langkah-langkah detail memuat diferensiasi (format HTML <ol><li>)
      - penutup: Langkah penutup dan doa (format HTML <ol><li>)
      - asesmen: Deskripsi asesmen awal, formatif, sumatif (format HTML <ul><li>)
      - refleksiMurid: 3 pertanyaan (format HTML <ol><li>)
      - refleksiGuru: 3 pertanyaan (format HTML <ol><li>)`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              pengetahuanAwal: { type: "STRING" }, minat: { type: "STRING" }, kebutuhanBelajar: { type: "STRING" },
              pemahamanBermakna: { type: "STRING" }, pertanyaanPemantik: { type: "STRING" },
              pendahuluan: { type: "STRING" }, inti: { type: "STRING" }, penutup: { type: "STRING" },
              asesmen: { type: "STRING" }, refleksiMurid: { type: "STRING" }, refleksiGuru: { type: "STRING" }
            },
            required: ["pengetahuanAwal", "minat", "kebutuhanBelajar", "pemahamanBermakna", "pertanyaanPemantik", "pendahuluan", "inti", "penutup", "asesmen", "refleksiMurid", "refleksiGuru"]
          }
        }
      };

      const data = await fetchWithRetry(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (resultText) {
        const p = JSON.parse(resultText);
        
        // Translation mapping for headers
        const t = {
          title: isEng ? "LESSON PLAN" : "RENCANA PELAKSANAAN PEMBELAJARAN (RPP)",
          subtitle: isEng ? "Integration of Love-Based Curriculum & Deep Learning" : "Integrasi Kurikulum Berbasis Cinta (KBC) & Pembelajaran Mendalam",
          part1: isEng ? "PART I: GENERAL INFORMATION" : "BAGIAN I: INFORMASI UMUM",
          idModul: isEng ? "A. RPP Identity" : "A. Identitas RPP",
          author: isEng ? "Author" : "Nama Penyusun",
          school: isEng ? "School" : "Satuan Pendidikan",
          year: isEng ? "Academic Year" : "Tahun Ajaran",
          subject: isEng ? "Subject" : "Mata Pelajaran",
          phase: isEng ? "Phase/Class" : "Kelas/Fase",
          topic: isEng ? "Topic/Chapter" : "Topik/Bab",
          time: isEng ? "Time Allocation" : "Alokasi Waktu",
          studentId: isEng ? "B. Student Identification" : "B. Identifikasi Murid",
          category: isEng ? "Category" : "Kategori",
          desc: isEng ? "Description" : "Deskripsi",
          priorKnow: isEng ? "Prior Knowledge" : "Pengetahuan Awal",
          interest: isEng ? "Interests" : "Minat",
          needs: isEng ? "Learning Needs" : "Kebutuhan Belajar",
          part2: isEng ? "PART II: CORE COMPONENTS" : "BAGIAN II: KOMPONEN INTI",
          obj: isEng ? "1. Learning Objectives" : "1. Tujuan Pembelajaran",
          meaning: isEng ? "2. Meaningful Understanding" : "2. Pemahaman Bermakna",
          trigger: isEng ? "3. Essential Questions" : "3. Pertanyaan Pemantik",
          part3: isEng ? "PART III: LEARNING ACTIVITIES" : "BAGIAN III: LANGKAH-LANGKAH PEMBELAJARAN",
          stage: isEng ? "Stage" : "Tahap",
          activity: isEng ? "Learning Activity" : "Kegiatan Pembelajaran",
          intro: isEng ? "Introduction<br/>(10 Minutes)" : "Pendahuluan<br/>(10 Menit)",
          core: isEng ? "Core Activity<br/>(45 Minutes)<br/><br/><span style='font-weight: normal; font-style: italic; font-size: 10pt;'>(Integrated Differentiation)</span>" : "Kegiatan Inti<br/>(45 Menit)<br/><br/><span style='font-weight: normal; font-style: italic; font-size: 10pt;'>(Diferensiasi Terintegrasi)</span>",
          closing: isEng ? "Closing<br/>(15 Minutes)" : "Penutup<br/>(15 Menit)",
          part4: isEng ? "PART IV: ASSESSMENT & SELF REFLECTION" : "BAGIAN IV: ASESMEN & REFLEKSI DIRI",
          assess: isEng ? "A. Assessment" : "A. Asesmen",
          refStu: isEng ? "B. Student Reflection" : "B. Refleksi Murid",
          refTea: isEng ? "C. Teacher Reflection" : "C. Refleksi Guru",
          know: isEng ? "Acknowledged by,<br/>Principal of MI BAS Tuban" : "Mengetahui,<br/>Kepala MI BAS Tuban",
          date: isEng ? "Tuban, [Date]<br/>Subject Teacher" : `Tuban, ${new Date().toLocaleDateString('id-ID')}<br/>Guru Mata Pelajaran`
        };

        const fullRppHtml = `
<div style="font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.5; font-size: 11pt; text-align: justify;">
  <h2 style="text-align: center; font-size: 14pt; margin-bottom: 5px; font-weight: bold; text-transform: uppercase;">${t.title} ${rppForm.mapel}</h2>
  <h3 style="text-align: center; font-size: 12pt; font-weight: normal; margin-top: 0; margin-bottom: 25px; font-style: italic;">${t.subtitle}</h3>
  
  <p style="font-weight: bold; margin-bottom: 5px; font-size: 12pt; background-color: #f0f0f0; padding: 4px;">${t.part1}</p>
  <p style="font-weight: bold; margin-bottom: 5px;">${t.idModul}</p>
  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border-color: #000;">
    <tr><td style="width: 30%; font-weight: bold;">${t.author}</td><td>[Nama Guru]</td></tr>
    <tr><td style="font-weight: bold;">${t.school}</td><td>MI BAS International Tuban</td></tr>
    <tr><td style="font-weight: bold;">${t.year}</td><td>2025/2026</td></tr>
    <tr><td style="font-weight: bold;">${t.subject}</td><td>${rppForm.mapel}</td></tr>
    <tr><td style="font-weight: bold;">${t.phase}</td><td>${rppForm.fase}</td></tr>
    <tr><td style="font-weight: bold;">${t.topic}</td><td>${rppForm.topik}</td></tr>
    <tr><td style="font-weight: bold;">${t.time}</td><td>2 x 35 ${isEng ? "Minutes" : "Menit"}</td></tr>
  </table>

  <p style="font-weight: bold; margin-bottom: 5px;">${t.studentId}</p>
  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border-color: #000;">
    <tr style="background-color: #f9f9f9;">
      <td style="width: 30%; font-weight: bold; text-align: center;">${t.category}</td>
      <td style="font-weight: bold; text-align: center;">${t.desc}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; vertical-align: top;">${t.priorKnow}</td>
      <td style="vertical-align: top; text-align: justify;">${p.pengetahuanAwal}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; vertical-align: top;">${t.interest}</td>
      <td style="vertical-align: top; text-align: justify;">${p.minat}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; vertical-align: top;">${t.needs}</td>
      <td style="vertical-align: top; text-align: justify;">${p.kebutuhanBelajar}</td>
    </tr>
  </table>

  <p style="font-weight: bold; margin-bottom: 5px; font-size: 12pt; background-color: #f0f0f0; padding: 4px;">${t.part2}</p>
  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border-color: #000;">
    <tr>
      <td style="vertical-align: top; width: 30%; font-weight: bold;">${t.obj}</td>
      <td style="vertical-align: top; text-align: justify;">${rppForm.tujuan}</td>
    </tr>
    <tr>
      <td style="vertical-align: top; font-weight: bold;">${t.meaning}</td>
      <td style="vertical-align: top; text-align: justify;">${p.pemahamanBermakna}</td>
    </tr>
    <tr>
      <td style="vertical-align: top; font-weight: bold;">${t.trigger}</td>
      <td style="vertical-align: top; text-align: justify;">${p.pertanyaanPemantik}</td>
    </tr>
  </table>

  <p style="font-weight: bold; margin-bottom: 5px; font-size: 12pt; background-color: #f0f0f0; padding: 4px;">${t.part3}</p>
  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border-color: #000;">
    <tr>
      <td style="vertical-align: top; width: 25%; font-weight: bold; text-align: center;">${t.stage}</td>
      <td style="vertical-align: top; font-weight: bold; text-align: center;">${t.activity}</td>
    </tr>
    <tr>
      <td style="vertical-align: top; font-weight: bold; text-align: center;">${t.intro}</td>
      <td style="vertical-align: top; text-align: justify;">${p.pendahuluan}</td>
    </tr>
    <tr>
      <td style="vertical-align: top; font-weight: bold; text-align: center;">${t.core}</td>
      <td style="vertical-align: top; text-align: justify;">${p.inti}</td>
    </tr>
    <tr>
      <td style="vertical-align: top; font-weight: bold; text-align: center;">${t.closing}</td>
      <td style="vertical-align: top; text-align: justify;">${p.penutup}</td>
    </tr>
  </table>

  <p style="font-weight: bold; margin-bottom: 5px; font-size: 12pt; background-color: #f0f0f0; padding: 4px;">${t.part4}</p>
  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border-color: #000;">
    <tr>
      <td style="vertical-align: top; width: 30%; font-weight: bold;">${t.assess}</td>
      <td style="vertical-align: top; text-align: justify;">${p.asesmen}</td>
    </tr>
    <tr>
      <td style="vertical-align: top; font-weight: bold;">${t.refStu}</td>
      <td style="vertical-align: top; text-align: justify;">${p.refleksiMurid}</td>
    </tr>
    <tr>
      <td style="vertical-align: top; font-weight: bold;">${t.refTea}</td>
      <td style="vertical-align: top; text-align: justify;">${p.refleksiGuru}</td>
    </tr>
  </table>
  
  <table style="width: 100%; border: none; margin-top: 40px; text-align: center;">
    <tr>
      <td style="width: 50%; border: none;">
        ${t.know}<br/><br/><br/><br/>
        <strong>(.......................................)</strong>
      </td>
      <td style="width: 50%; border: none;">
        ${t.date}<br/><br/><br/><br/>
        <strong>(.......................................)</strong>
      </td>
    </tr>
  </table>
</div>
        `;
        setGeneratedRpp(fullRppHtml);
      } else throw new Error("Respon AI kosong");
    } catch (error) {
      console.error("Gagal men-generate RPP KBC:", error);
      alert("Maaf Bos, koneksi ke mesin AI sedang terganggu. Coba klik Generate lagi.");
    } finally {
      setIsGeneratingRpp(false);
    }
  };

  // --- MODUL AJAR KBC + PSE GENERATOR (WITH TRANSLATION & TABLES) ---
  const generateModulKBC = async () => {
    if (!modulForm.mapel || !modulForm.topik) { 
        alert("Bos, lengkapi isian Mapel dan Topik!"); 
        return; 
    }
    
    setIsGeneratingModul(true); 
    setGeneratedModul(null); 
    setIsCopiedModul(false);

    const isEng = modulForm.language === 'English';

    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY || "ISI_API_KEY_DISINI";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      const prompt = `Anda adalah ahli kurikulum, pedagogik MI, dan asesor akreditasi BAN-PDM. Buatkan isi lengkap "Modul Ajar Deep Learning (KBC) Terintegrasi Pembelajaran Sosial Emosional (PSE)" yang terstruktur dan rapi.
      
      Pedomani instruksi krusial ini:
      1. Terapkan prinsip "Kurikulum Berbasis Cinta (KBC)" (Sebutkan Panca Cinta yang relevan).
      2. WAJIB integrasikan 5 Keterampilan Sosial Emosional (KSE): Kesadaran Diri, Manajemen Diri, Kesadaran Sosial, Keterampilan Berelasi, dan Pengambilan Keputusan yang Bertanggung Jawab.
      3. Terapkan Pembelajaran Berdiferensiasi (Visual, Auditori, Kinestetik).
      4. WAJIB sertakan praktik "Mindfulness" (contoh: Teknik STOP atau tarik napas dalam) pada kegiatan pendahuluan.

      PENTING: Bahasa Output yang diminta adalah: ${modulForm.language}. 
      Pastikan SELURUH nilai/teks di dalam JSON menggunakan bahasa ${modulForm.language}.
      
      Data Modul:
      Mata Pelajaran: ${modulForm.mapel}
      Fase/Kelas: ${modulForm.fase}
      Topik/Bab: ${modulForm.topik}
      Alokasi Waktu: ${modulForm.alokasi}

      Berikan output JSON dengan key berikut, TULISKAN SECARA SANGAT RINCI, EKSTRA PANJANG LEBAR, DAN KOMPREHENSIF PADA SETIAP BAGIAN KHUSUSNYA LKPD DAN ASESMEN. Format nilai HANYA berupa string HTML (gunakan tag <p style="text-align:justify; margin:0 0 8px 0; line-height:1.5;">, <ul>, <li>, <strong>, dll). Jangan gunakan tag markdown di luar JSON:
      - kesiapan: Narasi Kesiapan (Pengetahuan Awal, Minat, Kebutuhan Visual/Auditori/Kinestetik).
      - tema: Tema KBC & Integrasi KSE (Sebutkan Panca Cinta dan 5 KSE).
      - karakteristik: Karakteristik Materi (Konseptual, Prosedural, Relevansi).
      - profil: Dimensi Profil Lulusan & Profil Pelajar Pancasila.
      - desain: Capaian, Tujuan Pembelajaran, Indikator.
      - kerangka: Model Pembelajaran, Metode, Diferensiasi Konten/Proses/Produk.
      - langkah1: Langkah Pertemuan 1 (Pendahuluan dengan teknik Mindfulness; Inti; Penutup).
      - langkah2: Langkah Pertemuan 2 (Fokuskan Inti pada kolaborasi).
      - asesmen: Asesmen Diagnostik, Formatif, Sumatif.
      - lkpd: Isi dari LKPD (Tujuan, Instruksi, Tugas, dan format Rubrik Penilaian).`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              kesiapan: { type: "STRING" }, tema: { type: "STRING" }, karakteristik: { type: "STRING" },
              profil: { type: "STRING" }, desain: { type: "STRING" }, kerangka: { type: "STRING" },
              langkah1: { type: "STRING" }, langkah2: { type: "STRING" }, asesmen: { type: "STRING" }, lkpd: { type: "STRING" }
            },
            required: ["kesiapan", "tema", "karakteristik", "profil", "desain", "kerangka", "langkah1", "langkah2", "asesmen", "lkpd"]
          }
        }
      };

      const data = await fetchWithRetry(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (resultText) {
        const p = JSON.parse(resultText);
        
        // Bilingual Headers Mapping
        const t = {
          title: isEng ? "DEEP LEARNING TEACHING MODULE (KBC)" : "MODUL AJAR DEEP LEARNING (KBC)",
          subtitle: isEng ? "Integrated with Social Emotional Learning (SEL) & Differentiated Instruction" : "Terintegrasi Pembelajaran Sosial Emosional (PSE) & Berdiferensiasi",
          subject: isEng ? "SUBJECT" : "MATA PELAJARAN",
          chapter: isEng ? "CHAPTER" : "BAB",
          partA: isEng ? "A. MODULE IDENTITY" : "A. IDENTITAS MODUL",
          school: isEng ? "School Name" : "Nama Madrasah",
          author: isEng ? "Author" : "Nama Penyusun",
          phase: isEng ? "Phase / Class" : "Fase / Kelas",
          time: isEng ? "Time Allocation" : "Alokasi Waktu",
          partB: isEng ? "B. STUDENT READINESS IDENTIFICATION" : "B. IDENTIFIKASI KESIAPAN PESERTA DIDIK",
          partC: isEng ? "C. LOVE-BASED CURRICULUM (KBC) & SEL INTEGRATION THEME" : "C. TEMA KBC & INTEGRASI KSE (PEMBELAJARAN SOSIAL EMOSIONAL)",
          partD: isEng ? "D. LESSON MATERIAL CHARACTERISTICS" : "D. KARAKTERISTIK MATERI PELAJARAN",
          partE: isEng ? "E. GRADUATE PROFILE DIMENSIONS" : "E. DIMENSI PROFIL LULUSAN",
          designTitle: isEng ? "LEARNING DESIGN" : "DESAIN PEMBELAJARAN",
          partF: isEng ? "A. DESIGN & LEARNING OBJECTIVES" : "A. DESAIN & TUJUAN PEMBELAJARAN",
          partG: isEng ? "B. LEARNING FRAMEWORK" : "B. KERANGKA PEMBELAJARAN",
          partH: isEng ? "C. DIFFERENTIATED LEARNING STEPS" : "C. LANGKAH-LANGKAH PEMBELAJARAN BERDIFERENSIASI",
          meet1: isEng ? "MEETING 1" : "PERTEMUAN 1",
          meet2: isEng ? "MEETING 2" : "PERTEMUAN 2",
          partI: isEng ? "D. LEARNING ASSESSMENT" : "D. ASESMEN PEMBELAJARAN",
          lkpdTitle: isEng ? "STUDENT WORKSHEET (LKPD)" : "LEMBAR KERJA PESERTA DIDIK (LKPD)",
          material: isEng ? "Material" : "Materi"
        };

        const fullModulHtml = `
<div style="font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.5; font-size: 11pt; text-align: justify;">
  <h2 style="text-align: center; font-size: 14pt; margin-bottom: 5px; font-weight: bold; text-transform: uppercase;">${t.title}</h2>
  <h3 style="text-align: center; font-size: 11pt; font-weight: normal; margin-top: 0; margin-bottom: 25px; font-style: italic;">${t.subtitle}</h3>
  
  <div style="text-align: center; font-weight: bold; margin-bottom: 20px;">${t.subject}: ${modulForm.mapel.toUpperCase()} &nbsp; | &nbsp; ${t.chapter}: ${modulForm.topik.toUpperCase()}</div>

  <!-- TABLE A -->
  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; border-color: #000; margin-bottom: 20px;">
    <tr><td colspan="2" style="background-color: #f0f0f0; font-weight: bold; font-size: 12pt;">${t.partA}</td></tr>
    <tr><td style="width: 30%; font-weight: bold;">${t.school}</td><td style="text-align: justify;">MI BAS International Tuban</td></tr>
    <tr><td style="font-weight: bold;">${t.author}</td><td style="text-align: justify;">[Nama Guru]</td></tr>
    <tr><td style="font-weight: bold;">${t.subject}</td><td style="text-align: justify;">${modulForm.mapel}</td></tr>
    <tr><td style="font-weight: bold;">${t.phase}</td><td style="text-align: justify;">${modulForm.fase}</td></tr>
    <tr><td style="font-weight: bold;">${t.chapter}</td><td style="text-align: justify;">${modulForm.topik}</td></tr>
    <tr><td style="font-weight: bold;">${t.time}</td><td style="text-align: justify;">${modulForm.alokasi}</td></tr>
  </table>

  <!-- TABLE B -->
  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; border-color: #000; margin-bottom: 20px;">
    <tr><td style="background-color: #f0f0f0; font-weight: bold; font-size: 12pt;">${t.partB}</td></tr>
    <tr><td style="text-align: justify; vertical-align: top;">${p.kesiapan}</td></tr>
  </table>

  <!-- TABLE C -->
  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; border-color: #000; margin-bottom: 20px;">
    <tr><td style="background-color: #f0f0f0; font-weight: bold; font-size: 12pt;">${t.partC}</td></tr>
    <tr><td style="text-align: justify; vertical-align: top;">${p.tema}</td></tr>
  </table>

  <!-- TABLE D -->
  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; border-color: #000; margin-bottom: 20px;">
    <tr><td style="background-color: #f0f0f0; font-weight: bold; font-size: 12pt;">${t.partD}</td></tr>
    <tr><td style="text-align: justify; vertical-align: top;">${p.karakteristik}</td></tr>
  </table>

  <!-- TABLE E -->
  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; border-color: #000; margin-bottom: 30px;">
    <tr><td style="background-color: #f0f0f0; font-weight: bold; font-size: 12pt;">${t.partE}</td></tr>
    <tr><td style="text-align: justify; vertical-align: top;">${p.profil}</td></tr>
  </table>

  <div style="text-align: center; font-size: 13pt; font-weight: bold; margin: 30px 0 15px 0; border-bottom: 2px solid #000; padding-bottom: 5px;">${t.designTitle}</div>

  <!-- TABLE F -->
  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; border-color: #000; margin-bottom: 20px;">
    <tr><td style="background-color: #f9f9f9; font-weight: bold; font-size: 12pt;">${t.partF}</td></tr>
    <tr><td style="text-align: justify; vertical-align: top;">${p.desain}</td></tr>
  </table>

  <!-- TABLE G -->
  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; border-color: #000; margin-bottom: 20px;">
    <tr><td style="background-color: #f9f9f9; font-weight: bold; font-size: 12pt;">${t.partG}</td></tr>
    <tr><td style="text-align: justify; vertical-align: top;">${p.kerangka}</td></tr>
  </table>

  <!-- TABLE H (LANGKAH PEMBELAJARAN) -->
  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; border-color: #000; margin-bottom: 20px;">
    <tr><td colspan="2" style="background-color: #f9f9f9; font-weight: bold; font-size: 12pt;">${t.partH}</td></tr>
    <tr>
      <td style="width: 25%; font-weight: bold; text-align: center; vertical-align: top;">${t.meet1}</td>
      <td style="text-align: justify; vertical-align: top;">${p.langkah1}</td>
    </tr>
    <tr>
      <td style="width: 25%; font-weight: bold; text-align: center; vertical-align: top;">${t.meet2}</td>
      <td style="text-align: justify; vertical-align: top;">${p.langkah2}</td>
    </tr>
  </table>

  <!-- TABLE I -->
  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; border-color: #000; margin-bottom: 30px;">
    <tr><td style="background-color: #f9f9f9; font-weight: bold; font-size: 12pt;">${t.partI}</td></tr>
    <tr><td style="text-align: justify; vertical-align: top;">${p.asesmen}</td></tr>
  </table>

  <!-- LKPD SECTION (Also wrapped in table for consistent layout) -->
  <table border="2" cellpadding="15" cellspacing="0" style="width: 100%; border-collapse: collapse; border-color: #000; margin-top: 40px; background-color: #fafafa;">
    <tr>
      <td style="text-align: justify; vertical-align: top;">
        <h3 style="text-align: center; margin-top: 0;">${t.lkpdTitle}</h3>
        <div style="text-align: center; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">${t.material}: ${modulForm.topik}</div>
        ${p.lkpd}
      </td>
    </tr>
  </table>

</div>
        `;
        setGeneratedModul(fullModulHtml);
      } else throw new Error("Respon AI kosong");
    } catch (error) {
      console.error("Gagal men-generate Modul KBC:", error);
      alert("Maaf Bos, koneksi ke mesin AI sedang terganggu. Coba klik Generate lagi.");
    } finally {
      setIsGeneratingModul(false);
    }
  };

  // --- HANDLER SOP ---
  const handleButirSopChange = (e) => {
    const val = e.target.value;
    setSopForm(prev => ({ ...prev, konteks: val }));
    
    if (val === 'b12') setSopForm(prev => ({ ...prev, judul: 'SOP Pencegahan dan Penanganan Kekerasan (TPPK)' }));
    else if (val === 'b13') setSopForm(prev => ({ ...prev, judul: 'SOP Mitigasi dan Penanganan Keadaan Darurat / Bencana' }));
    else if (val === 'kepegawaian') setSopForm(prev => ({ ...prev, judul: 'SOP Evaluasi Kinerja dan Pembinaan Pendidik' }));
    else setSopForm(prev => ({ ...prev, judul: '' }));
  };

  const generateSopWithAI = async () => {
    if (!sopForm.judul) { alert("Bos, isi judul SOP-nya dulu dong!"); return; }
    setIsGeneratingSop(true); setGeneratedSop(null);

    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY || "ISI_API_KEY_DISINI";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      let referensiInstruksi = "Gunakan pedoman standar resmi Kementerian Agama Republik Indonesia.";
      if (sopForm.konteks === 'kepegawaian') referensiInstruksi = "Gunakan SECARA MUTLAK 'Keputusan Ketua Yayasan Bahrul Huda Tuban Nomor 01 Tahun 2024 tentang Peraturan Kepegawaian' sebagai dasar hukum urutan pertama.";
      else if (sopForm.konteks === 'b12') referensiInstruksi = "Gunakan Permendikbudristek No 46 Tahun 2023 tentang Pencegahan dan Penanganan Kekerasan (TPPK).";

      const prompt = `Buatkan isi detail untuk Standar Operasional Prosedur (SOP) di MI BAS International Tuban dengan judul: "${sopForm.judul}".
      Instruksi Khusus Referensi: ${referensiInstruksi}`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              dasarHukum: { type: "STRING" }, kualifikasiPelaksana: { type: "STRING" },
              keterkaitan: { type: "STRING" }, peralatan: { type: "STRING" },
              peringatan: { type: "STRING" }, pencatatan: { type: "STRING" }, prosedur: { type: "STRING" }
            }
          }
        }
      };

      const data = await fetchWithRetry(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (resultText) {
        const parsed = JSON.parse(resultText);
        parsed.judul = sopForm.judul;
        parsed.nomorSOP = `MI-BAS/SOP/2026/${Math.floor(Math.random() * 900 + 100).toString()}`;
        parsed.tanggal = new Date().toLocaleDateString('id-ID');
        setGeneratedSop(parsed);
      } else throw new Error("Respon AI kosong");
    } catch (error) {
      console.error("Gagal men-generate SOP:", error);
      alert("Koneksi ke mesin AI sedang terganggu. Coba lagi.");
    } finally {
      setIsGeneratingSop(false);
    }
  };

  const formatToHTML = (text) => {
    if (!text || typeof text !== 'string') return '-';
    if (text.includes('<ol>') || text.includes('<ul>') || text.includes('<p>')) return text; // already html
    const lines = text.split('\n');
    let html = ''; let inList = false; let listType = '';
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const isNumbered = /^\d+[\.\)]\s+/.test(trimmed);
      const isBulleted = /^[-•*]\s+/.test(trimmed);
      if (isNumbered || isBulleted) {
        const currentType = isNumbered ? 'ol' : 'ul';
        const cleanText = trimmed.replace(/^(\d+[\.\)]|[-•*])\s+/, '');
        if (!inList) { html += `<${currentType} style="margin-top: 6px; margin-bottom: 6px; padding-left: 24px; text-align: justify;">`; inList = true; listType = currentType; } 
        else if (inList && listType !== currentType) { html += `</${listType}><${currentType} style="margin-top: 6px; margin-bottom: 6px; padding-left: 24px; text-align: justify;">`; listType = currentType; }
        html += `<li style="margin-bottom: 6px; line-height: 1.5;">${cleanText}</li>`;
      } else {
        if (inList) { html += `</${listType}>`; inList = false; }
        html += `<p style="margin-top: 6px; margin-bottom: 6px; text-align: justify; line-height: 1.5;">${trimmed}</p>`;
      }
    });
    if (inList) html += `</${listType}>`;
    return html;
  };

  const copyToClipboard = (text, type) => {
    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = text;
      document.body.appendChild(tempDiv);
      const extractedText = tempDiv.innerText || text;
      document.body.removeChild(tempDiv);

      const textArea = document.createElement("textarea");
      textArea.value = extractedText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      
      if(type === 'rpp') {
        setIsCopiedRpp(true);
        setTimeout(() => setIsCopiedRpp(false), 2000);
      } else if (type === 'modul') {
        setIsCopiedModul(true);
        setTimeout(() => setIsCopiedModul(false), 2000);
      }
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  // --- DOWNLOAD FUNCTIONS ---
  const downloadChecklistWord = () => {
    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Checklist Akreditasi MI BAS</title>
      <style>
        body { font-family: 'Arial', sans-serif; color: #333; line-height: 1.5; }
        h1 { text-align: center; color: #008080; border-bottom: 2px solid #008080; padding-bottom: 10px; }
        h2 { color: #006666; margin-top: 30px; background-color: #f0f8f8; padding: 10px; border-radius: 5px; }
        h3 { color: #444; margin-top: 20px; border-left: 4px solid #008080; padding-left: 10px; }
        ul { list-style-type: none; padding-left: 20px; margin-top: 5px; margin-bottom: 15px; }
        li { margin-bottom: 12px; font-size: 11pt; }
        .checked { color: green; font-weight: bold; }
        .unchecked { color: #888; }
        .desc { font-style: italic; font-size: 10pt; color: #666; margin-bottom: 15px; }
        .indikator { font-weight: bold; font-size: 11pt; margin-top: 15px; color: #333; }
        .sub-indikator { font-weight: bold; font-size: 10pt; color: #008080; margin-top: 10px; padding-left: 15px; }
      </style></head><body>
      <h1>Daftar Kelengkapan Bukti Dukung Akreditasi (BAN-PDM)</h1>
      <p style="text-align:center;"><strong>MI BAS International Tuban - Tahun 2026</strong></p>
      <p style="text-align:center; font-size: 10pt;"><em>Dicetak pada: ${new Date().toLocaleString('id-ID')}</em></p>
    `;

    akreditasiData.forEach(comp => {
      htmlContent += `<h2>${comp.title}</h2>`;
      comp.butirs.forEach(butir => {
        htmlContent += `<h3>${butir.title}</h3>`;
        htmlContent += `<p class="desc">${butir.desc}</p>`;
        butir.indikators.forEach(ind => {
          htmlContent += `<div class="indikator">${ind.title}</div>`;
          htmlContent += `<div class="sub-indikator">${ind.subText}</div>`;
          htmlContent += `<ul>`;
          ind.evidences.forEach(ev => {
            const isChecked = checkedEvidences[ev.id];
            const checkMark = isChecked ? '☑' : '☐';
            const statusClass = isChecked ? 'checked' : 'unchecked';
            const statusText = isChecked ? ' (TERPENUHI)' : '';
            
            htmlContent += `<li class="${statusClass}">
              <span style="font-size: 14pt;">${checkMark}</span> ${ev.text} ${statusText}
            </li>`;
          });
          htmlContent += `</ul>`;
        });
      });
    });

    htmlContent += `</body></html>`;
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `Checklist_Akreditasi_MIBAS_Lengkap.doc`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  const downloadHtmlAsWord = (htmlContent, fileName) => {
    if (!htmlContent) return;
    const wrappedHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${fileName}</title>
      <style>
        body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-color: #000; }
        th, td { border: 1px solid black; padding: 8px; vertical-align: top; text-align: justify; }
        h2, h3, h4 { color: #000; margin-top: 15px; margin-bottom: 10px; }
        ol, ul { margin-top: 5px; margin-bottom: 10px; padding-left: 20px; text-align: justify; }
        p { margin-top: 5px; margin-bottom: 10px; text-align: justify; line-height: 1.5; }
      </style></head><body>
        ${htmlContent}
      </body></html>`;
    const blob = new Blob(['\ufeff', wrappedHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${fileName}.doc`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  const downloadSopWord = () => {
    if (!generatedSop) return;
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>SOP - ${generatedSop.judul}</title>
      <style>
        body { font-family: 'Arial', sans-serif; font-size: 11pt; color: #000; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-color: #000; }
        th, td { border: 1px solid black; padding: 10px; vertical-align: top; }
        .center { text-align: center; } .bold { font-weight: bold; }
        .header-title { font-size: 13pt; font-weight: bold; text-align: center; margin-bottom: 4px; }
        .header-sub { font-size: 12pt; text-align: center; }
        ol, ul { margin-top: 5px; margin-bottom: 5px; padding-left: 20px; text-align: justify; } p { margin-top: 5px; margin-bottom: 5px; text-align: justify; }
      </style></head><body>
        <table>
          <tr>
            <td width="50%" class="center" style="vertical-align: middle;">
              <div class="header-title">KEMENTERIAN AGAMA REPUBLIK INDONESIA</div>
              <div class="header-sub">MADRASAH IBTIDAIYAH BAS INTERNATIONAL TUBAN</div>
            </td>
            <td width="50%">
              <div><span class="bold">Nomor SOP:</span> ${generatedSop.nomorSOP}</div>
              <div><span class="bold">Tanggal Efektif:</span> ${generatedSop.tanggal}</div>
              <div><span class="bold">Disahkan Oleh:</span> Kepala MI BAS Tuban</div>
            </td>
          </tr>
          <tr><td colspan="2" class="center" style="background-color: #f2f2f2;"><div class="header-title" style="margin:0;">NAMA SOP: ${generatedSop.judul.toUpperCase()}</div></td></tr>
          <tr><td width="50%"><div class="bold">Dasar Hukum:</div><div>${formatToHTML(generatedSop.dasarHukum)}</div></td><td width="50%"><div class="bold">Kualifikasi Pelaksana:</div><div>${formatToHTML(generatedSop.kualifikasiPelaksana)}</div></td></tr>
          <tr><td width="50%"><div class="bold">Keterkaitan:</div><div>${formatToHTML(generatedSop.keterkaitan)}</div></td><td width="50%"><div class="bold">Peralatan / Perlengkapan:</div><div>${formatToHTML(generatedSop.peralatan)}</div></td></tr>
          <tr><td width="50%"><div class="bold">Peringatan:</div><div>${formatToHTML(generatedSop.peringatan)}</div></td><td width="50%"><div class="bold">Pencatatan / Pendataan:</div><div>${formatToHTML(generatedSop.pencatatan)}</div></td></tr>
        </table>
        <div style="border: 1px solid black; padding: 15px; margin-top: -1px;"><div class="bold" style="margin-bottom: 12px; font-size: 12pt; text-decoration: underline;">PROSEDUR / LANGKAH-LANGKAH KERJA:</div><div>${formatToHTML(generatedSop.prosedur)}</div></div>
      </body></html>`;
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `SOP_${generatedSop.judul.replace(/[^a-z0-9]/gi, '_')}.doc`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  // --- DATA AKREDITASI FLAT & EKSTREM LENGKAP ---
  const akreditasiData = [
    {
      id: 'comp1', title: "KOMPONEN 1: Kinerja Pendidik dalam Mengelola Proses Pembelajaran", icon: <Users size={20} className="text-[#008080]" />, 
      drive: "https://drive.google.com/drive/folders/1YQGnAu9DdUR1fd3XjrcPJXy1x44DSj9X?usp=share_link",
      butirs: [
        { id: 'b1', title: "Butir 1: Pendidik menyediakan dukungan sosial emosional bagi peserta didik...", desc: "Mengukur iklim interaksi, pola pikir bertumbuh, dan keterampilan sosial emosional.", 
          indikators: [
          { id: 'ind-1-1-1', title: "Indikator 1.1.1: Interaksi yang setara dan saling menghargai", subText: "Sub-indikator: Terjadi percakapan bermakna, interaksi menghargai, murid merasa dihargai.",
            evidences: [
              { id: 'e111-1', text: "RPP/Modul (siswa aktif, PSE)" },
              { id: 'e111-2', text: "Video pembelajaran" },
              { id: 'e111-3', text: "Lembar Kerja Kelompok" },
              { id: 'e111-4', text: "Form Penilaian Diskusi" },
              { id: 'e111-5', text: "Hasil Karya siswa" },
              { id: 'e111-6', text: "KSP halaman terkait" }
            ]
          },
          { id: 'ind-1-1-2', title: "Indikator 1.1.2: Interaksi yang membangun pola pikir bertumbuh", subText: "Sub-indikator: Praktik pengajaran umpan balik, murid memiliki pola pikir bertumbuh.",
            evidences: [
              { id: 'e112-1', text: "RPP (berdiferensiasi)" },
              { id: 'e112-2', text: "Video pembelajaran" },
              { id: 'e112-3', text: "Lembar Kerja Siswa" },
              { id: 'e112-4', text: "Hasil Asesmen" },
              { id: 'e112-5', text: "Hasil karya siswa yang diapresiasi" },
              { id: 'e112-6', text: "Rapor" }
            ]
          },
          { id: 'ind-1-1-3', title: "Indikator 1.1.3: Memberi perhatian dan bantuan pada murid yang membutuhkan dukungan ekstra", subText: "Sub-indikator: Identifikasi murid, bantuan bagi murid, pelibatan murid dan orang tua.",
            evidences: [
              { id: 'e113-1', text: "RPP" },
              { id: 'e113-2', text: "Hasil asesmen diagnostik" },
              { id: 'e113-3', text: "Catatan observasi/refleksi guru" },
              { id: 'e113-4', text: "Program remedial/pengayaan" },
              { id: 'e113-5', text: "Jadwal pendampingan dan materinya" },
              { id: 'e113-6', text: "Hasil karya siswa yg diberikan umpan balik" }
            ]
          },
          { id: 'ind-1-1-4', title: "Indikator 1.1.4: Strategi pengajaran yang membangun keterampilan sosial emosional...", subText: "Sub-indikator: Proses belajar merespons kondisi sosial emosional, membantu murid mengelola emosi, dukungan kemandirian.",
            evidences: [
              { id: 'e114-1', text: "RPP yg memuat PSE" },
              { id: 'e114-2', text: "Dokumen asesmen ttg aspek SE" },
              { id: 'e114-3', text: "Dokumentasi video kegiatan sosial emosional" },
              { id: 'e114-4', text: "Hasil karya tentang pengelolaan emosi" },
              { id: 'e114-5', text: "Catatan guru BK dan guru agama" }
            ]
          }
        ] },
        { id: 'b2', title: "Butir 2: Pendidik mengelola kelas untuk menciptakan suasana belajar yang aman, nyaman...", desc: "Fokus pada kesepakatan kelas partisipatif dan disiplin positif.", 
          indikators: [
          { id: 'ind-1-2-1', title: "Indikator 1.2.1: Kesepakatan kelas yang disusun secara partisipatif", subText: "Sub-indikator: Keberadaan kesepakatan kelas, pengalaman murid mengikuti proses, digunakan sebagai acuan.",
            evidences: [
              { id: 'e121-1', text: "Pajangan kesepakatan kelas" },
              { id: 'e121-2', text: "Video proses penyusunan" },
              { id: 'e121-3', text: "Catatan penegakan disiplin" },
              { id: 'e121-4', text: "Notulen penyusunan di TTD perwakilan siswa" },
              { id: 'e121-5', text: "Dokumentasi kegiatan kelas" }
            ]
          },
          { id: 'ind-1-2-2', title: "Indikator 1.2.2: Penegakan disiplin dengan pendekatan positif", subText: "Sub-indikator: Teguran verbal tenang, tidak ada hukuman fisik/ancaman, penerapan pendekatan dialogis.",
            evidences: [
              { id: 'e122-1', text: "SOP disiplin positif siswa dan guru" },
              { id: 'e122-2', text: "Catatan penyelesaian kasus kedisiplinan" }
            ]
          },
          { id: 'ind-1-2-3', title: "Indikator 1.2.3: Waktu di kelas terfokus pada kegiatan belajar", subText: "Sub-indikator: Murid terlibat aktif tanpa distraksi, penerapan strategi pembelajaran aktif.",
            evidences: [
              { id: 'e123-1', text: "Foto/video proses belajar aktif" },
              { id: 'e123-2', text: "RPP memuat strategi aktif" },
              { id: 'e123-3', text: "Hasil kerja siswa" },
              { id: 'e123-4', text: "Jurnal refleksi guru" }
            ]
          }
        ] },
        { id: 'b3', title: "Butir 3: Pendidik mengelola proses pembelajaran secara efektif dan bermakna", desc: "Validasi perencanaan, formatif, sumatif, dan pelaporan.", 
          indikators: [
          { id: 'ind-1-3-1', title: "Indikator 1.3.1: Perencanaan yang memadai untuk mendukung pelaksanaan pembelajaran", subText: "Sub-indikator: Rencana minimal berisi tujuan, cara, teknik evaluasi, mengikuti silabus, berdasarkan kebutuhan belajar.",
            evidences: [
              { id: 'e131-1', text: "Bukti workshop" },
              { id: 'e131-2', text: "Modul ajar/RPP" },
              { id: 'e131-3', text: "Asesmen diagnostik/sumatif" },
              { id: 'e131-4', text: "Materi sumber belajar" }
            ]
          },
          { id: 'ind-1-3-2', title: "Indikator 1.3.2: Penilaian formatif digunakan sebagai umpan balik...", subText: "Sub-indikator: Penerapan asesmen formatif berkala, hasil menentukan strategi, penyampaian hasil asesmen.",
            evidences: [
              { id: 'e132-1', text: "RPP" },
              { id: 'e132-2', text: "Hasil asesmen formatif" },
              { id: 'e132-3', text: "Hasil kerja siswa dan umpan balik siswa" }
            ]
          },
          { id: 'ind-1-3-3', title: "Indikator 1.3.3: Penilaian sumatif dilakukan dengan metode beragam...", subText: "Sub-indikator: Asesmen sumatif berkala, tidak hanya bentuk angka, teknik instrumen sesuai tujuan.",
            evidences: [
              { id: 'e133-1', text: "RPP" },
              { id: 'e133-2', text: "Hasil asesmen sumatif (STS, SAS)" },
              { id: 'e133-3', text: "Daftar nilai kelas" },
              { id: 'e133-4', text: "Rapor sisipan dan akhir" }
            ]
          },
          { id: 'ind-1-3-4', title: "Indikator 1.3.4: Hasil penilaian dilaporkan secara informatif...", subText: "Sub-indikator: Laporan dikomunikasikan berkala, berisi uraian perkembangan, berasal dari asesmen formatif sumatif, memberikan rekomendasi.",
            evidences: [
              { id: 'e134-1', text: "Refleksi diri siswa" },
              { id: 'e134-2', text: "Laporan hasil belajar tengah/akhir semester" },
              { id: 'e134-3', text: "Rubrik penilaian dan hasil analisis" },
              { id: 'e134-4', text: "Dokumentasi pertemuan ortu" }
            ]
          },
          { id: 'ind-1-3-5', title: "Indikator 1.3.5: Praktik pengajaran memfasilitasi murid untuk menganalisis...", subText: "Sub-indikator: Mendorong bernalar, membangun keterhubungan secara aplikatif.",
            evidences: [
              { id: 'e135-1', text: "Hasil refleksi siswa" },
              { id: 'e135-2', text: "Video pembelajaran kontekstual (PBL)" },
              { id: 'e135-3', text: "RPP pembelajaran kontekstual" },
              { id: 'e135-4', text: "Dokumentasi pembelajaran berbasis projek" }
            ]
          }
        ] },
        { id: 'b4', title: "Butir 4: Pendidik memfasilitasi pembelajaran efektif dalam membangun keimanan... karakter", desc: "Penguatan keimanan, sejarah, bernalar, dan misi sekolah.", 
          indikators: [
          { id: 'ind-1-4-1', title: "Indikator 1.4.1: Pembelajaran menguatkan keimanan dan ketakwaan...", subText: "Sub-indikator: Keimanan tidak terbatas pembelajaran, memfasilitasi refleksi ajaran agama, keterhubungan dengan perilaku.",
            evidences: [
              { id: 'e141-1', text: "KSP" },
              { id: 'e141-2', text: "Jadwal kegiatan keagamaan" },
              { id: 'e141-3', text: "RPP penguatan karakter" },
              { id: 'e141-4', text: "Video pembelajarn karakter" },
              { id: 'e141-5', text: "Hasil penilaian karakter" }
            ]
          },
          { id: 'ind-1-4-2', title: "Indikator 1.4.2: Pembelajaran menguatkan kecintaan terhadap sejarah, budaya...", subText: "Sub-indikator: Topik membangun pemahaman kekayaan budaya, memfasilitasi analisis sejarah, dibangun tidak terbatas intrakurikuler.",
            evidences: [
              { id: 'e142-1', text: "RPP tematik budaya" },
              { id: 'e142-2', text: "Foto/video pembelajaran budaya" },
              { id: 'e142-3', text: "Foto/video kegiatan hari besar nasional" },
              { id: 'e142-4', text: "Karya siswa bertema budaya" },
              { id: 'e142-5', text: "Kokurikuler berbasis budaya" }
            ]
          },
          { id: 'ind-1-4-3', title: "Indikator 1.4.3: Pembelajaran memfasilitasi kemampuan bernalar dan memecahkan masalah", subText: "Sub-indikator: Praktik memecahkan masalah, relevan konteks kebutuhan, penerapan rutin.",
            evidences: [
              { id: 'e143-1', text: "KSP" },
              { id: 'e143-2', text: "RPP berbasis masalah/proyek" },
              { id: 'e143-3', text: "Hasil karya murid" },
              { id: 'e143-4', text: "Video keterlibatan murid" }
            ]
          },
          { id: 'ind-1-4-4', title: "Indikator 1.4.4: Pembelajaran membangun kompetensi/karakter misi utama sekolah", subText: "Sub-indikator: Eksplisit diketahui warga, konsisten dibangun proses pembelajaran, dibangun melalui budaya sekolah.",
            evidences: [
              { id: 'e144-1', text: "KSP visi misi" },
              { id: 'e144-2', text: "RPP/sumber belajar" },
              { id: 'e144-3', text: "Video pembelajaran kompetensi" },
              { id: 'e144-4', text: "Dokumentasi kegiatan intra, ko dan ekstra" }
            ]
          }
        ] }
      ]
    },
    {
      id: 'comp2', title: "KOMPONEN 2: Kepemimpinan Kepala Satuan Pendidikan dalam Pengelolaan", icon: <BookOpen size={20} className="text-[#008080]" />, 
      drive: "https://drive.google.com/drive/folders/11NSF8XLBJn21_giK0WcCPTynik87sg2R?usp=share_link",
      butirs: [
        { id: 'b5', title: "Butir 5: Kepala satuan pendidikan menerapkan budaya refleksi...", desc: "Fokus pada evaluasi berkelanjutan, PTK, dan supervisi akademik kepala madrasah.", 
          indikators: [
          { id: 'ind-2-5-1', title: "Indikator 2.5.1: Fasilitasi kepada guru untuk refleksi kinerja", subText: "Sub-indikator: Guru melakukan refleksi, tata kelola sistematis minimal 6 bulan sekali, memfasilitasi pemanfaatan hasil refleksi.",
            evidences: [
              { id: 'e251-1', text: "SOP refleksi guru" },
              { id: 'e251-2', text: "Hasil refleksi kinerja guru" },
              { id: 'e251-3', text: "Video kegiatan refleksi" },
              { id: 'e251-4', text: "Dokumen hasil refleksi" }
            ]
          },
          { id: 'ind-2-5-2', title: "Indikator 2.5.2: Evaluasi kinerja dilakukan oleh kepsek secara berkala", subText: "Sub-indikator: Evaluasi kinerja sistematis 6 bulan sekali, tata kelola memanfaatkan hasil evaluasi.",
            evidences: [
              { id: 'e252-1', text: "Hasil PKG/PKKS 2 tahun terakhir" },
              { id: 'e252-2', text: "Laporan hasil evaluasi PTK" },
              { id: 'e252-3', text: "SOP evaluasi kinerja" },
              { id: 'e252-4', text: "Dokumentasi/Notulen pembinaan" }
            ]
          },
          { id: 'ind-2-5-3', title: "Indikator 2.5.3: Program pengembangan profesional guru telah dilakukan", subText: "Sub-indikator: Terlaksana program pengembangan, program disusun berdasar hasil refleksi.",
            evidences: [
              { id: 'e253-1', text: "Laporan daftar pelatihan 1 tahun terakhir" },
              { id: 'e253-2', text: "Sertifikat diklat" },
              { id: 'e253-3', text: "Daftar hadir dokumentasi" },
              { id: 'e253-4', text: "Pengembangan Profesional (PKB)" }
            ]
          },
          { id: 'ind-2-5-4', title: "Indikator 2.5.4: Pengelolaan guru dan tenaga kependidikan yang efektif dan akuntabel", subText: "Sub-indikator: Panduan tata kelola, mekanisme penghargaan/sanksi, tidak ada penunggakan honorarium.",
            evidences: [
              { id: 'e254-1', text: "SK pengangkatan/penugasan/sanksi" },
              { id: 'e254-2', text: "Pedoman/SOP tata kelola PTK" }
            ]
          }
        ] },
        { id: 'b6', title: "Butir 6: Kepala satuan pendidikan menghadirkan layanan belajar partisipatif...", desc: "Kemitraan, visi misi, dan evaluasi KSP.", 
          indikators: [
          { id: 'ind-2-6-1', title: "Indikator 2.6.1: Visi dan misi jelas dan dipahami", subText: "Sub-indikator: Visi misi jelas, pemahaman warga sekolah.",
            evidences: [
              { id: 'e261-1', text: "RKS" },
              { id: 'e261-2', text: "Hasil refleksi tahunan" },
              { id: 'e261-3', text: "Notulen rapat" },
              { id: 'e261-4', text: "Dokumen visi misi" },
              { id: 'e261-5', text: "Media publikasi visi misi" },
              { id: 'e261-6', text: "Hasil survei pemahaman" }
            ]
          },
          { id: 'ind-2-6-2', title: "Indikator 2.6.2: Adanya kolaborasi atau kemitraan dengan berbagai pihak", subText: "Sub-indikator: Kolaborasi orang tua/wali, kolaborasi pihak eksternal.",
            evidences: [
              { id: 'e262-1', text: "Dok MoU kemitraan" },
              { id: 'e262-2', text: "Program dan Dokumentasi kegiatan" },
              { id: 'e262-3', text: "Dokumen mekanisme komunikasi ortu" },
              { id: 'e262-4', text: "Dokumentasi pelibatan orang tua" }
            ]
          },
          { id: 'ind-2-6-3', title: "Indikator 2.6.3: Pelaksanaan evaluasi/refleksi berbasis data...", subText: "Sub-indikator: Pengumpulan data evaluasi, terlaksananya diskusi evaluasi.",
            evidences: [
              { id: 'e263-1', text: "Notulen rapat/diskusi evaluasi KSP/RKT" },
              { id: 'e263-2', text: "Data hasil capaian program" },
              { id: 'e263-3', text: "Rekap hasil belajar" },
              { id: 'e263-4', text: "Hasil analisis EDM dan Rapor pendidikan" }
            ]
          },
          { id: 'ind-2-6-4', title: "Indikator 2.6.4: Perencanaan kegiatan tahunan berdasarkan data evaluasi/refleksi", subText: "Sub-indikator: Perencanaan tahunan rujukan, disusun melibatkan berbagai pihak, mempertimbangkan hasil evaluasi, mengutamakan prioritas, meliputi bidang pembelajaran, tendik, sarpras.",
            evidences: [
              { id: 'e264-1', text: "Hasil analisis EDM dan Rapor Pendidikan" },
              { id: 'e264-2', text: "Rencana kerja tahunan berbasis data" },
              { id: 'e264-3', text: "Laporan tindak lanjut hasil evaluasi" }
            ]
          }
        ] },
        { id: 'b7', title: "Butir 7: Kepala satuan pendidikan memastikan pengelolaan anggaran...", desc: "Transparansi dan realisasi anggaran RKAS.", 
          indikators: [
          { id: 'ind-2-7-1', title: "Indikator 2.7.1: Anggaran sekolah dikelola sesuai perencanaan", subText: "Sub-indikator: Tersedia perencanaan penganggaran satu tahun, berkesinambungan dengan perencanaan, disusun bersama komite.",
            evidences: [
              { id: 'e271-1', text: "RAPBS/RKAS" },
              { id: 'e271-2', text: "Laporan realisasi BOS" },
              { id: 'e271-3', text: "Notulen pembahasan anggaran" },
              { id: 'e271-4', text: "Dokumen berita acara rapat" }
            ]
          },
          { id: 'ind-2-7-2', title: "Indikator 2.7.2: Rencana anggaran menunjukkan sumber pendanaan dan alokasi", subText: "Sub-indikator: Rencana memiliki sumber, perincian, tujuan, dilaporkan kepada pihak berwenang.",
            evidences: [
              { id: 'e272-1', text: "RKAS" },
              { id: 'e272-2', text: "Laporan keuangan BOS" },
              { id: 'e272-3', text: "Papan/ruang/media informasi keuangan" }
            ]
          },
          { id: 'ind-2-7-3', title: "Indikator 2.7.3: Laporan berkala pemanfaatan anggaran", subText: "Sub-indikator: Ada laporan pemanfaatan, realisasi sesuai perencanaan yang disahkan, pelaporan kepada pihak terkait.",
            evidences: [
              { id: 'e273-1', text: "LPJ pemanfaatan anggaran 2 thn" },
              { id: 'e273-2', text: "Laporan keuangan yg disetujui/disahkan" }
            ]
          }
        ] },
        { id: 'b8', title: "Butir 8: Kepala satuan pendidikan memimpin pengelolaan sarana dan prasarana...", desc: "Pemeliharaan fasilitas, keamanan lingkungan fisik, dan pendayagunaan sarpras.", 
          indikators: [
          { id: 'ind-2-8-1', title: "Indikator 2.8.1: Pemenuhan sarana dan prasarana sesuai kebutuhan belajar", subText: "Sub-indikator: Relevansi sarana prasarana dengan kebutuhan belajar, warga terlihat nyaman.",
            evidences: [
              { id: 'e281-1', text: "Hasil Analisis kebutuhan sarana" },
              { id: 'e281-2', text: "Bukti pemenuhan" },
              { id: 'e281-3', text: "Data inventaris" },
              { id: 'e281-4', text: "Foto kondisi sarpras" },
              { id: 'e281-5', text: "Jadwal pemeliharaan" }
            ]
          },
          { id: 'ind-2-8-2', title: "Indikator 2.8.2: Pengelolaan sarana dan prasarana secara optimal", subText: "Sub-indikator: Pemeliharaan secara optimal, pemanfaatan secara optimal.",
            evidences: [
              { id: 'e282-1', text: "Buku peminjaman sarpras" },
              { id: 'e282-2', text: "SOP pengelolaan sarpras" },
              { id: 'e282-3', text: "Jadwal perawatan" },
              { id: 'e282-4', text: "Laporan pemeliharaan dan perbaikan" }
            ]
          }
        ] },
        { id: 'b9', title: "Butir 9: Kepala satuan pendidikan mengembangkan kurikulum...", desc: "KSP, silabus, evaluasi, dan relevansi kurikulum.", 
          indikators: [
          { id: 'ind-2-9-1', title: "Indikator 2.9.1: Kepemilikan kurikulum satuan pendidikan (KSP)", subText: "Sub-indikator: Memiliki KSP, KSP berisi silabus TP, pengorganisasian pembelajaran (intra, ko, ekstra), program penilaian.",
            evidences: [
              { id: 'e291-1', text: "Dokumen KSP lengkap" },
              { id: 'e291-2', text: "SK pengesahan" },
              { id: 'e291-3', text: "Silabus sekolah" }
            ]
          },
          { id: 'ind-2-9-2', title: "Indikator 2.9.2: Mekanisme evaluasi terhadap penerapan kurikulum", subText: "Sub-indikator: Ada mekanisme evaluasi, Keterlibatan kepala sekolah.",
            evidences: [
              { id: 'e292-1', text: "Notulen evaluasi KSP (asesmen, refleksi, umpan balik)" },
              { id: 'e292-2', text: "Revisi dokumen KSP" }
            ]
          },
          { id: 'ind-2-9-3', title: "Indikator 2.9.3: KSP relevan dengan kebutuhan belajar dan visi misi", subText: "Sub-indikator: KSP dirancang berdasar visi misi, Penyesuaian KSP berdasar evaluasi.",
            evidences: [
              { id: 'e293-1', text: "Dokumen revisi KSP (memuat karakteristik, visi misi)" },
              { id: 'e293-2', text: "Laporan hasil analisis kebutuhan belajar" }
            ]
          }
        ] }
      ]
    },
    {
      id: 'comp3', title: "KOMPONEN 3: Iklim Lingkungan Belajar", icon: <ShieldCheck size={20} className="text-[#008080]" />, 
      drive: "https://drive.google.com/drive/folders/1dV7ZaNG4WV1JUS8lbvHiFmYYYzBC8Tpd?usp=share_link",
      butirs: [
        { id: 'b10', title: "Butir 10: Satuan pendidikan memastikan terbangunnya iklim kebinekaan...", desc: "Toleransi, anti diskriminasi, dan kesetaraan gender.", 
          indikators: [
          { id: 'ind-3-10-1', title: "Indikator 3.10.1: Iklim lingkungan belajar membangun sikap positif...", subText: "Sub-indikator: Muatan membangun sikap positif, Proses bertujuan sikap positif, Program pendukung dan suasana.",
            evidences: [
              { id: 'e3101-1', text: "KSP muatan kebijakan" },
              { id: 'e3101-2', text: "Kebijakan keberagaman, dokumentasi kegiatan lintas budaya" },
              { id: 'e3101-3', text: "Program lintas budaya" },
              { id: 'e3101-4', text: "Dokumentasi Bhinneka Tunggal Ika" }
            ]
          },
          { id: 'ind-3-10-2', title: "Indikator 3.10.2: Iklim lingkungan belajar memfasilitasi hak sipil beribadah", subText: "Sub-indikator: Fasilitasi kegiatan ibadah, pemberian kesempatan melaksanakan ibadah perayaan.",
            evidences: [
              { id: 'e3102-1', text: "Data siswa agama minoritas dan SOP" },
              { id: 'e3102-2', text: "Jadwal kegiatan ibadah" },
              { id: 'e3102-3', text: "Dokumentasi fasilitas ibadah" }
            ]
          },
          { id: 'ind-3-10-3', title: "Indikator 3.10.3: Iklim lingkungan belajar membangun kesadaran kesetaraan gender", subText: "Sub-indikator: Proses membangun sikap positif, hak sama murid berkiprah, hak sama guru tendik.",
            evidences: [
              { id: 'e3103-1', text: "KSP Kebijakan kesetaraan gender" },
              { id: 'e3103-2', text: "RPP muatan materi" },
              { id: 'e3103-3', text: "Dokumentasi kegiatan bersama" }
            ]
          }
        ] },
        { id: 'b11', title: "Butir 11: Satuan pendidikan menyediakan lingkungan inklusif...", desc: "Fasilitas dan pembelajaran untuk ABK.", 
          indikators: [
          { id: 'ind-3-11-1', title: "Indikator 3.11.1: Kebijakan menghadirkan lingkungan belajar inklusif", subText: "Sub-indikator: Kebijakan mengakomodasi murid penyandang disabilitas, prosedur memandu fasilitasi murid berkebutuhan khusus.",
            evidences: [
              { id: 'e3111-1', text: "SK kebijakan inklusi" },
              { id: 'e3111-2', text: "SOP layanan ABK" },
              { id: 'e3111-3', text: "Foto kegiatan pendampingan" },
              { id: 'e3111-4', text: "Data siswa inklusif" },
              { id: 'e3111-5', text: "SOP identifikasi & intervensi" }
            ]
          },
          { id: 'ind-3-11-2', title: "Indikator 3.11.2: Program bagi guru, ortu, dan murid untuk inklusi", subText: "Sub-indikator: Pembekalan bagi guru, pembekalan murid, pembekalan orang tua/wali.",
            evidences: [
              { id: 'e3112-1', text: "Materi pelatihan guru" },
              { id: 'e3112-2', text: "Sertifikat kegiatan" },
              { id: 'e3112-3', text: "Daftar hadir" },
              { id: 'e3112-4', text: "Dokumentasi kegiatan" },
              { id: 'e3112-5', text: "Panduan interaksi siswa" },
              { id: 'e3112-6', text: "Materi sosialisasi ortu" }
            ]
          }
        ] },
        { id: 'b12', title: "Butir 12: Satuan pendidikan mewujudkan iklim lingkungan belajar aman...", desc: "Pencegahan perundungan dan tindak lanjut.", 
          indikators: [
          { id: 'ind-3-12-1', title: "Indikator 3.12.1: Kebijakan pencegahan/penanganan perundungan", subText: "Sub-indikator: Kebijakan mencegah menangani, keberadaan tim PPK, Prosedur penanganan.",
            evidences: [
              { id: 'e3121-1', text: "Dokumen kebijakan" },
              { id: 'e3121-2', text: "Tim Pencegahan Perundungan" },
              { id: 'e3121-3', text: "SOP Pencegahan, Penanganan, Pasca" }
            ]
          },
          { id: 'ind-3-12-2', title: "Indikator 3.12.2: Program bagi warga dalam pencegahan perundungan", subText: "Sub-indikator: Pembelajaran membangun kesadaran, Pembekalan warga, adanya pihak bimbingan konseling.",
            evidences: [
              { id: 'e3122-1', text: "Dokumentasi pembekalan" },
              { id: 'e3122-2', text: "Tim TPPK" },
              { id: 'e3122-3', text: "SOP" },
              { id: 'e3122-4', text: "Laporan BK" }
            ]
          }
        ] },
        { id: 'b13', title: "Butir 13: Satuan pendidikan memastikan keselamatan...", desc: "Jaminan keselamatan bangunan dan P3K.", 
          indikators: [
          { id: 'ind-3-13-1', title: "Indikator 3.13.1: Iklim lingkungan belajar menjaga keselamatan", subText: "Sub-indikator: Bangunan tidak membahayakan, sarana tidak melukai, peringatan potensi bahaya, mitigasi keselamatan.",
            evidences: [
              { id: 'e3131-1', text: "Laporan inspeksi keselamatan" },
              { id: 'e3131-2', text: "Foto rambu evakuasi" },
              { id: 'e3131-3', text: "Hasil audit keselamatan" },
              { id: 'e3131-4', text: "Dokumentasi sarpras" }
            ]
          },
          { id: 'ind-3-13-2', title: "Indikator 3.13.2: Kesiapan P3K", subText: "Sub-indikator: Pembekalan PTK tentang P3K, Akses peralatan P3K, Ruang kesehatan.",
            evidences: [
              { id: 'e3132-1', text: "Daftar alat P3K" },
              { id: 'e3132-2', text: "Foto ruang UKS" },
              { id: 'e3132-3', text: "Dokumen pembekalan" },
              { id: 'e3132-4', text: "Panduan P3K" }
            ]
          },
          { id: 'ind-3-13-3', title: "Indikator 3.13.3: Kesiapan menghadapi ragam potensi bencana", subText: "Sub-indikator: Ketersediaan prosedur simulasi, isi prosedur memberi panduan jelas, simulasi rutin, mekanisme review prosedur.",
            evidences: [
              { id: 'e3133-1', text: "SOP evakuasi" },
              { id: 'e3133-2', text: "Dokumentasi simulasi mitigasi bencana" }
            ]
          }
        ] },
        { id: 'b14', title: "Butir 14: Satuan pendidikan menjamin lingkungan sehat...", desc: "Kesehatan fisik, mental, dan edukasi adiksi.", 
          indikators: [
          { id: 'ind-3-14-1', title: "Indikator 3.14.1: Iklim lingkungan belajar membangun pola hidup bersih", subText: "Sub-indikator: Muatan kesadaran PHBS, pilihan makanan aman, kebersihan lingkungan, program prasarana bergerak aktif.",
            evidences: [
              { id: 'e3141-1', text: "Jadwal senam" },
              { id: 'e3141-2', text: "Dokumentasi kegiatan kesehatan" },
              { id: 'e3141-3', text: "Laporan UKS" },
              { id: 'e3141-4', text: "Dokumentasi program PHBS" },
              { id: 'e3141-5', text: "Jadwal piket" }
            ]
          },
          { id: 'ind-3-14-2', title: "Indikator 3.14.2: Program untuk membangun kesehatan mental...", subText: "Sub-indikator: Muatan kesadaran kesehatan mental, layanan bimbingan penyuluhan, ruang istirahat guru.",
            evidences: [
              { id: 'e3142-1', text: "Dokumen pembekalan bagi guru" },
              { id: 'e3142-2', text: "Dokumen layanan bimbingan murid" },
              { id: 'e3142-3', text: "Foto ruang guru dan tendik" }
            ]
          },
          { id: 'ind-3-14-3', title: "Indikator 3.14.3: Edukasi pencegahan adiksi dan kesehatan reproduksi", subText: "Sub-indikator: Kegiatan pencegahan adiksi, strategi mendukung pencegahan adiksi, kegiatan pemahaman kesehatan reproduksi.",
            evidences: [
              { id: 'e3143-1', text: "Dokumen/Dokumentasi kegiatan" },
              { id: 'e3143-2', text: "Laporan kegiatan" }
            ]
          }
        ] }
      ]
    }
  ];

  const getProgress = (butirIndikators) => {
    let total = 0; let checked = 0;
    butirIndikators.forEach(ind => {
      total += ind.evidences.length;
      ind.evidences.forEach(ev => { if (checkedEvidences[ev.id]) checked++; });
    });
    return { checked, total, percentage: total === 0 ? 0 : Math.round((checked / total) * 100) };
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-[#008080] selection:text-white relative pb-24">
      {/* --- NAVIGATION --- */}
      <nav className="fixed top-0 left-0 right-0 bg-[#008080] text-white shadow-md z-40 px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="shrink-0 text-white drop-shadow-md transition-transform hover:scale-105">
            <ShieldCheck size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight leading-none truncate drop-shadow-sm">MI BAS INTERNATIONAL</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[9px] opacity-90 uppercase tracking-widest font-semibold">
                Sistem Akreditasi 
                <span className="hidden md:inline"> | Dibuat oleh @achmad ramadhan, S.Pd. Ai.</span>
              </p>
              {isSyncing ? (
                <span className="flex items-center gap-1 text-[9px] bg-yellow-400/20 text-yellow-200 px-1.5 py-0.5 rounded-full font-bold">
                  <Loader2 size={10} className="animate-spin" /> Menghubungkan...
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] bg-green-400/20 text-green-200 px-1.5 py-0.5 rounded-full font-bold">
                  <Wifi size={10} /> Cloud Tersinkron
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 no-scrollbar shrink-0">
          <button onClick={() => setActiveTab('dashboard')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'dashboard' ? 'bg-white text-[#008080] shadow-sm' : 'bg-[#006666] text-white hover:bg-[#005555]'}`}>
             <Target size={14}/> Tracker Dokumen
          </button>
          <button onClick={() => setActiveTab('interview')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'interview' ? 'bg-white text-[#008080] shadow-sm' : 'bg-[#006666] text-white hover:bg-[#005555]'}`}>
            <UserCheck size={14} /> Simulasi Asesor
          </button>
          <button onClick={() => setActiveTab('generator')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'generator' ? 'bg-white text-[#008080] shadow-sm' : 'bg-[#006666] text-white hover:bg-[#005555]'}`}>
            <Layers size={14} /> Generator Administrasi AI
          </button>
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="pt-32 md:pt-24 px-4 md:px-8 max-w-7xl mx-auto">
        
        {/* TAB 1: DASHBOARD TRACKER */}
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in duration-500">
             <section className="mb-8 relative">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 items-center justify-between overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#008080]/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
                <div className="flex-1 relative z-10">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                      <Wifi size={12}/> Live Collaboration
                    </span>
                    <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                      <Code2 size={12}/> Dibuat oleh @achmad ramadhan, S.Pd. Ai.
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">SUKSES AKREDITASI UNGGUL <Sparkles className="text-yellow-500" size={20} /></h2>
                    <button 
                      onClick={downloadChecklistWord}
                      className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 whitespace-nowrap"
                    >
                      <Download size={16} /> Unduh Checklist (Word)
                    </button>
                  </div>
                  
                  <div className="bg-gradient-to-r from-[#008080]/10 to-transparent p-5 rounded-xl border-l-4 border-[#008080] relative">
                    <Quote className="absolute top-3 right-4 text-[#008080] opacity-10" size={48} />
                    <p className="text-slate-700 text-sm leading-relaxed max-w-3xl font-medium">
                      "Akreditasi BAN-PDM 2026 bukan lagi sekadar mengumpulkan tumpukan kertas, melainkan <strong>pembuktian kinerja riil</strong>. Kunci mutlak keberhasilan MI BAS ada pada <span className="text-[#008080] font-black underline decoration-2 underline-offset-4">Triangulasi Data</span>. Unggah file buktinya langsung ke Drive Komponen!"
                    </p>
                  </div>
                </div>
                <div className="relative z-10 bg-[#008080]/10 border border-[#008080]/20 px-6 py-4 rounded-xl flex items-center gap-4 shrink-0 hidden md:flex">
                  <Target className="text-[#008080]" size={32} />
                  <div>
                    <p className="text-xs text-[#008080] font-bold uppercase tracking-wider mb-1">Target Validasi</p>
                    <p className="text-xl font-black text-slate-800 leading-none">14 Butir Full</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 relative z-10">
              {akreditasiData.map((comp) => (
                <div key={comp.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden mb-4">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="w-10 h-10 bg-white shadow-sm border border-slate-100 rounded-xl flex items-center justify-center shrink-0">{comp.icon}</div>
                      <h3 className="font-extrabold text-[15px] text-slate-800 leading-tight">{comp.title}</h3>
                    </div>
                    <a href={comp.drive} target="_blank" rel="noopener noreferrer" className="w-full md:w-auto bg-[#008080] hover:bg-[#006666] text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs font-bold shadow-sm transition-colors whitespace-nowrap shrink-0">
                      <UploadCloud size={16} /> Buka Folder Master K{comp.id.replace('comp', '')}
                    </a>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[800px] p-4 space-y-3 bg-slate-50">
                    {comp.butirs.map((butir) => {
                      const progress = getProgress(butir.indikators);
                      const isExpanded = expandedButir[butir.id];
                      const isComplete = progress.total > 0 && progress.percentage === 100;

                      return (
                        <div key={butir.id} className={`border rounded-xl transition-all duration-200 overflow-hidden ${isComplete ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white shadow-sm'}`}>
                          <button onClick={() => toggleAccordion(butir.id)} className="w-full flex items-center justify-between p-4 text-left focus:outline-none hover:bg-slate-50/50">
                            <div className="flex-1 pr-4">
                              <p className={`text-sm font-bold leading-relaxed ${isComplete ? 'text-green-800' : 'text-slate-800'}`}>{butir.title}</p>
                              <p className="text-[11px] text-slate-500 mt-1.5 leading-snug italic font-medium opacity-90">{butir.desc}</p>
                              <div className="flex items-center gap-2 mt-3">
                                <div className="h-2 w-full max-w-[150px] bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-[#008080]'}`} style={{ width: `${progress.percentage}%` }} />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">{progress.checked}/{progress.total} Bukti Terkumpul</span>
                              </div>
                            </div>
                            <div className="text-slate-400">{isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-5 pt-2 border-t border-slate-100 bg-white">
                              <div className="space-y-6 mt-3">
                                {butir.indikators.map((indikator) => (
                                  <div key={indikator.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                                    <p className="text-[13px] font-black text-slate-800 mb-1 leading-tight">{indikator.title}</p>
                                    <p className="text-[11px] font-bold text-[#008080] mb-4 pb-3 border-b border-slate-200 leading-snug">{indikator.subText}</p>
                                    
                                    <div className="pl-2">
                                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Daftar Bukti Dukung:</p>
                                      <div className="space-y-2 mb-3">
                                        {indikator.evidences.map((evidence) => {
                                          const isChecked = checkedEvidences[evidence.id];
                                          
                                          return (
                                            <div key={evidence.id} className={`p-2.5 rounded-lg border transition-colors ${isChecked ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200 hover:border-[#008080]/50'}`}>
                                              <div className="flex items-start gap-3 cursor-pointer" onClick={() => toggleEvidence(evidence.id)}>
                                                <div className="mt-0.5 shrink-0">
                                                  {isChecked ? <CheckSquare size={18} className="text-green-600" /> : <Square size={18} className="text-slate-300" />}
                                                </div>
                                                <span className={`text-[12px] leading-relaxed ${isChecked ? 'text-green-900 font-medium' : 'text-slate-700'}`}>
                                                  {evidence.text}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      
                                      <div className="mt-4">
                                        <a href={comp.drive} target="_blank" rel="noreferrer" className="text-[11px] bg-white border border-[#008080] text-[#008080] px-4 py-2 rounded-md hover:bg-[#008080] hover:text-white transition-colors font-bold flex items-center justify-center gap-1.5 w-full sm:w-fit shadow-sm">
                                          <UploadCloud size={14} /> Upload Bukti Dukung ke Folder K{comp.id.replace('comp', '')}
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: SIMULASI ASESOR */}
        {activeTab === 'interview' && (
          <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
            <div className="mb-6 flex items-start gap-4 bg-purple-50 border border-purple-200 p-5 rounded-2xl shadow-sm">
              <div className="bg-white p-2 rounded-xl border border-purple-100"><UserCheck size={24} className="text-purple-600" /></div>
              <div>
                <h3 className="font-extrabold text-purple-900 text-lg mb-1">Simulasi Wawancara (Triangulasi)</h3>
                <p className="text-sm text-purple-800/80 leading-relaxed">
                  Asesor tidak cuma melihat dokumen kertas. Mereka memvalidasi praktik di lapangan dengan wawancara. 
                  Gunakan fitur ini untuk melatih kesiapan mental dan substansi jawaban Guru, Kepala Sekolah, dan Murid.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Target Wawancara</label>
                  <select 
                    value={simulasiForm.target} 
                    onChange={(e) => setSimulasiForm({...simulasiForm, target: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="Guru">Guru / Tenaga Pendidik</option>
                    <option value="Kepala Madrasah">Kepala Madrasah</option>
                    <option value="Murid">Peserta Didik (Murid)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Uji Indikator Butir</label>
                  <select 
                    value={simulasiForm.butir} 
                    onChange={(e) => setSimulasiForm({...simulasiForm, butir: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  >
                    {akreditasiData.flatMap(c => c.butirs).map(b => (
                      <option key={b.id} value={b.id}>{b.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                onClick={generateSimulasi}
                disabled={isGeneratingQuestions}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed mb-8"
              >
                {isGeneratingQuestions ? <><Loader2 size={18} className="animate-spin" /> Menganalisis Pola Asesor...</> : <><Sparkles size={18} /> Generate Pertanyaan Asesor</>}
              </button>

              {generatedQuestions && (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="font-black text-slate-800 flex items-center gap-2"><Target size={18} className="text-purple-600"/> Daftar Pertanyaan Validasi</h4>
                      <span className="bg-purple-100 text-purple-800 text-[10px] px-3 py-1 rounded-full font-bold uppercase">Role: {generatedQuestions.role}</span>
                    </div>
                    <div className="p-6">
                      <div className="mb-6 bg-red-50 border border-red-100 p-4 rounded-xl flex gap-3 items-start">
                        <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-red-800 leading-relaxed">{generatedQuestions.tips}</p>
                      </div>
                      
                      <ul className="space-y-4">
                        {generatedQuestions.questions.map((q, i) => (
                          <li key={i} className="flex gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-black text-sm shrink-0">Q{i+1}</span>
                            <p className="text-slate-700 font-medium leading-relaxed pt-1">{q}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: GENERATOR ADMINISTRASI AI */}
        {activeTab === 'generator' && (
          <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
            
            <div className="flex flex-col sm:flex-row bg-white rounded-xl p-1.5 shadow-sm border border-slate-200 mb-6 w-full max-w-3xl mx-auto gap-1">
              <button 
                onClick={() => setActiveGenerator('modul')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeGenerator === 'modul' ? 'bg-[#008080] text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
              >
                <BookMarked size={16} /> Modul Ajar (Lengkap + PSE)
              </button>
              <button 
                onClick={() => setActiveGenerator('rpp')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeGenerator === 'rpp' ? 'bg-[#008080] text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
              >
                <Wand2 size={16} /> RPP KBC (Simple)
              </button>
              <button 
                onClick={() => setActiveGenerator('sop')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeGenerator === 'sop' ? 'bg-[#008080] text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
              >
                <ClipboardList size={16} /> Generator SOP
              </button>
            </div>

            {/* MODUL AJAR DEEP LEARNING + PSE */}
            {activeGenerator === 'modul' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="mb-4 bg-purple-50 border border-purple-200 p-4 rounded-xl shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                      <HeartHandshake size={64} />
                    </div>
                    <div className="flex gap-3 items-start relative z-10">
                      <Sparkles size={20} className="text-purple-600 mt-0.5 shrink-0"/>
                      <p className="text-xs text-purple-800 font-medium leading-relaxed">
                        <strong>PEMENUHAN BUTIR 1:</strong> AI akan menyusun Modul Ajar komprehensif dengan pendekatan <em>Deep Learning</em> KBC lengkap beserta insersi <strong>Pembelajaran Sosial Emosional (PSE)</strong> secara mutlak.
                      </p>
                    </div>
                  </div>
                  <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2 border-b pb-3"><BookMarked className="text-[#008080]" size={20} /> Input Modul + PSE</h2>
                  <div className="space-y-4">
                    {/* LANGUAGE SELECTOR */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Bahasa Output / Language</label>
                      <select className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080]" value={modulForm.language} onChange={(e) => setModulForm({...modulForm, language: e.target.value})}>
                        <option value="Indonesia">Bahasa Indonesia</option>
                        <option value="English">English</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Mata Pelajaran</label>
                      <input type="text" className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080]" value={modulForm.mapel} onChange={(e) => setModulForm({...modulForm, mapel: e.target.value})} placeholder="Contoh: Bahasa Inggris" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Fase / Kelas</label>
                      <select className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080]" value={modulForm.fase} onChange={(e) => setModulForm({...modulForm, fase: e.target.value})}>
                        <option value="A (Kelas 1)">Fase A (Kelas 1 MI)</option><option value="A (Kelas 2)">Fase A (Kelas 2 MI)</option>
                        <option value="B (Kelas 3)">Fase B (Kelas 3 MI)</option><option value="B (Kelas 4)">Fase B (Kelas 4 MI)</option>
                        <option value="C (Kelas 5)">Fase C (Kelas 5 MI)</option><option value="C (Kelas 6)">Fase C (Kelas 6 MI)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Topik / Bab</label>
                      <input type="text" className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080]" value={modulForm.topik} onChange={(e) => setModulForm({...modulForm, topik: e.target.value})} placeholder="Contoh: How are you?" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Alokasi Waktu</label>
                      <input type="text" className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080]" value={modulForm.alokasi} onChange={(e) => setModulForm({...modulForm, alokasi: e.target.value})} placeholder="Contoh: 4-6 JP (2-3 kali pertemuan)" />
                    </div>
                    
                    <button onClick={generateModulKBC} disabled={isGeneratingModul} className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-70">
                      {isGeneratingModul ? <><Loader2 size={18} className="animate-spin" /> Menganalisis KBC & PSE...</> : <><Sparkles size={18} /> Generate Modul + PSE</>}
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[650px]">
                  <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><BookMarked size={18} className="text-purple-600"/> Preview Modul Ajar + PSE</h3>
                    <div className="flex gap-2">
                      {generatedModul && (
                        <>
                          <button onClick={() => copyToClipboard(generatedModul, 'modul')} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-100 shadow-sm">
                            {isCopiedModul ? <CheckCircle2 size={14} className="text-green-600"/> : <Copy size={14} />} {isCopiedModul ? 'Tersalin!' : 'Salin Text'}
                          </button>
                          <button onClick={() => downloadHtmlAsWord(generatedModul, `Modul_KBC_PSE_${modulForm.mapel}`)} className="flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 bg-gradient-to-r from-purple-600 to-[#008080] text-white rounded-md hover:shadow-lg shadow-sm transition-all animate-pulse hover:animate-none">
                            <Download size={14} /> Unduh Word
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 p-6 overflow-y-auto bg-slate-100/50">
                    {generatedModul ? (
                      <div className="bg-white p-4 sm:p-8 rounded-lg shadow-sm border border-slate-200 shadow-inner overflow-x-auto" dangerouslySetInnerHTML={{ __html: generatedModul }} />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <HeartHandshake size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">Modul Ajar Deep Learning + PSE</p>
                        <p className="text-xs mt-1 text-center px-8">Format dokumen akan memuat instruksi spesifik KSE seperti Kesadaran Diri (Mindfulness) & Keterampilan Berelasi yang dicetak ke dalam layout Tabel rata kanan-kiri.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* RPP KBC GENERATOR VIEW (SIMPLE) */}
            {activeGenerator === 'rpp' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-left-4 duration-300">
                <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="mb-4 bg-teal-50 border border-teal-200 p-3 rounded-lg">
                    <p className="text-xs text-teal-800 font-medium">
                      Gunakan tab ini untuk *generate* RPP versi ringkas (1-2 halaman). Cocok untuk administrasi cepat.
                    </p>
                  </div>
                  <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2 border-b pb-3"><FileText className="text-[#008080]" size={20} /> Input Data RPP</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Bahasa Output / Language</label>
                      <select className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080]" value={rppForm.language} onChange={(e) => setRppForm({...rppForm, language: e.target.value})}>
                        <option value="Indonesia">Bahasa Indonesia</option>
                        <option value="English">English</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Mata Pelajaran</label>
                      <input type="text" className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080]" value={rppForm.mapel} onChange={(e) => setRppForm({...rppForm, mapel: e.target.value})} placeholder="Fikih, IPAS, Akidah Akhlak, dll" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Fase / Kelas</label>
                      <select className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080]" value={rppForm.fase} onChange={(e) => setRppForm({...rppForm, fase: e.target.value})}>
                        <option value="A (Kelas 1-2)">Fase A (Kelas 1-2 MI)</option><option value="B (Kelas 3-4)">Fase B (Kelas 3-4 MI)</option><option value="C (Kelas 5-6)">Fase C (Kelas 5-6 MI)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Topik / Materi</label>
                      <input type="text" className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080]" value={rppForm.topik} onChange={(e) => setRppForm({...rppForm, topik: e.target.value})} placeholder="Contoh: Rukun Islam" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tujuan Pembelajaran</label>
                      <textarea className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#008080] h-16 resize-none" value={rppForm.tujuan} onChange={(e) => setRppForm({...rppForm, tujuan: e.target.value})} placeholder="Peserta didik dapat memahami..." />
                    </div>
                    <div className="pt-2">
                      <label className="block text-xs font-bold text-slate-700 mb-2 border-b pb-1">Strategi Diferensiasi (Wajib 1)</label>
                      <div className="space-y-2">
                        {['konten', 'proses', 'produk'].map(type => (
                          <label key={type} className="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" className="w-4 h-4 text-[#008080]" checked={rppForm.diferensiasi[type]} onChange={(e) => setRppForm({...rppForm, diferensiasi: {...rppForm.diferensiasi, [type]: e.target.checked}})} />
                            <span className="text-sm font-medium text-slate-700 capitalize">Diferensiasi {type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <button onClick={generateRppKBC} disabled={isGeneratingRpp} className="w-full mt-4 bg-[#008080] hover:bg-[#006666] text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-70">
                      {isGeneratingRpp ? <><Loader2 size={18} className="animate-spin" /> Meracik RPP KBC...</> : <><Wand2 size={18} /> Generate RPP KBC</>}
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
                  <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><FileText size={18} className="text-[#008080]"/> Preview RPP KBC</h3>
                    <div className="flex gap-2">
                      {generatedRpp && (
                        <>
                          <button onClick={() => copyToClipboard(generatedRpp, 'rpp')} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-100 shadow-sm">
                            {isCopiedRpp ? <CheckCircle2 size={14} className="text-green-600"/> : <Copy size={14} />} {isCopiedRpp ? 'Tersalin!' : 'Salin Text'}
                          </button>
                          <button onClick={() => downloadHtmlAsWord(generatedRpp, `RPP_KBC_${rppForm.mapel}`)} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-[#008080] text-white rounded-md hover:bg-[#006666] shadow-sm">
                            <Download size={14} /> Unduh Word
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 p-6 overflow-y-auto bg-slate-100/50">
                    {generatedRpp ? (
                      <div className="bg-white p-4 sm:p-8 rounded-lg shadow-sm border border-slate-200 shadow-inner overflow-x-auto" dangerouslySetInnerHTML={{ __html: generatedRpp }} />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Wand2 size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">AI siap meracik RPP KBC</p>
                        <p className="text-xs mt-1 text-center px-8">Format RPP ringkas Kemenag.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SOP GENERATOR VIEW */}
            {activeGenerator === 'sop' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-right-4 duration-300">
                <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Pilih Sumber Referensi AI</label>
                      <select value={sopForm.konteks} onChange={handleButirSopChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]">
                        <option value="">-- Pilih Referensi Hukum --</option>
                        <option value="b12">Pedoman TPPK (Pencegahan Kekerasan)</option>
                        <option value="b13">Pedoman Penanganan Bencana/Darurat</option>
                        <option value="kepegawaian">Aturan Kepegawaian Yayasan BAH (Mutlak!)</option>
                        <option value="custom">Format Standar Kemenag / Umum</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Judul Spesifik SOP</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]" 
                        value={sopForm.judul} 
                        onChange={(e) => setSopForm({...sopForm, judul: e.target.value})} 
                        placeholder="Ketik judul SOP, misal: SOP Cuti Guru" 
                      />
                    </div>
                    
                    <button 
                      onClick={generateSopWithAI} 
                      disabled={isGeneratingSop} 
                      className="w-full mt-2 bg-[#008080] hover:bg-[#006666] text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-70"
                    >
                      {isGeneratingSop ? <><Loader2 size={18} className="animate-spin" /> AI sedang meracik dokumen...</> : <><Sparkles size={18} /> Generate SOP dengan AI</>}
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
                  <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><FileText size={18} className="text-[#008080]"/> Preview Lembar SOP</h3>
                    <div className="flex gap-2">
                      {generatedSop && (
                        <button onClick={downloadSopWord} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-[#008080] text-white rounded-md hover:bg-[#006666] shadow-sm">
                          <Download size={14} /> Unduh Word
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 p-6 overflow-y-auto bg-slate-100/50 relative">
                    
                    {generatedSop && (
                      <div className="mb-4 bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex gap-3 items-start shadow-sm">
                        <AlertTriangle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-800 leading-relaxed">
                          <strong>Peringatan Kritis:</strong> Wajib <em>cross-check</em> dan sesuaikan hasil AI ini dengan realita lapangan MI BAS Tuban sebelum dicetak.
                        </p>
                      </div>
                    )}

                    {generatedSop ? (
                      <div className="bg-white p-4 sm:p-8 rounded-lg shadow-sm border border-slate-200 text-[10px] sm:text-xs text-slate-800 shadow-inner overflow-x-auto">
                        <table className="w-full border-collapse border border-slate-800 mb-4 table-fixed">
                          <tbody>
                            <tr>
                              <td className="border border-slate-800 p-3 w-1/2 text-center align-middle">
                                <div className="font-bold text-sm">KEMENTERIAN AGAMA REPUBLIK INDONESIA</div>
                                <div className="font-bold">MADRASAH IBTIDAIYAH BAS INTERNATIONAL TUBAN</div>
                              </td>
                              <td className="border border-slate-800 p-3 w-1/2 align-top">
                                <div><span className="font-bold inline-block w-32">Nomor SOP</span>: {generatedSop.nomorSOP}</div>
                                <div><span className="font-bold inline-block w-32">Tanggal Pembuatan</span>: {generatedSop.tanggal}</div>
                                <div><span className="font-bold inline-block w-32">Tanggal Revisi</span>: -</div>
                                <div><span className="font-bold inline-block w-32">Tanggal Efektif</span>: {generatedSop.tanggal}</div>
                                <div><span className="font-bold inline-block w-32">Disahkan Oleh</span>: Kepala MI BAS Tuban</div>
                              </td>
                            </tr>
                            <tr>
                              <td colSpan="2" className="border border-slate-800 p-3 text-center align-middle bg-slate-50">
                                <div className="font-bold text-sm">NAMA SOP: {generatedSop.judul.toUpperCase()}</div>
                              </td>
                            </tr>
                            <tr>
                              <td className="border border-slate-800 p-4 w-1/2 align-top">
                                <div className="font-bold mb-2">Dasar Hukum:</div>
                                <div dangerouslySetInnerHTML={{ __html: formatToHTML(generatedSop.dasarHukum) }} />
                              </td>
                              <td className="border border-slate-800 p-4 w-1/2 align-top">
                                <div className="font-bold mb-2">Kualifikasi Pelaksana:</div>
                                <div dangerouslySetInnerHTML={{ __html: formatToHTML(generatedSop.kualifikasiPelaksana) }} />
                              </td>
                            </tr>
                            <tr>
                              <td className="border border-slate-800 p-4 w-1/2 align-top">
                                <div className="font-bold mb-2">Keterkaitan:</div>
                                <div dangerouslySetInnerHTML={{ __html: formatToHTML(generatedSop.keterkaitan) }} />
                              </td>
                              <td className="border border-slate-800 p-4 w-1/2 align-top">
                                <div className="font-bold mb-2">Peralatan / Perlengkapan:</div>
                                <div dangerouslySetInnerHTML={{ __html: formatToHTML(generatedSop.peralatan) }} />
                              </td>
                            </tr>
                            <tr>
                              <td className="border border-slate-800 p-4 w-1/2 align-top">
                                <div className="font-bold mb-2">Peringatan:</div>
                                <div dangerouslySetInnerHTML={{ __html: formatToHTML(generatedSop.peringatan) }} />
                              </td>
                              <td className="border border-slate-800 p-4 w-1/2 align-top">
                                <div className="font-bold mb-2">Pencatatan / Pendataan:</div>
                                <div dangerouslySetInnerHTML={{ __html: formatToHTML(generatedSop.pencatatan) }} />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <div className="mt-4 border border-slate-800 p-4">
                          <div className="font-bold mb-3 underline decoration-slate-400 underline-offset-4">PROSEDUR / LANGKAH-LANGKAH KERJA:</div>
                          <div dangerouslySetInnerHTML={{ __html: formatToHTML(generatedSop.prosedur) }} />
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Bot size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">AI siap membantu Coach</p>
                        <p className="text-xs mt-1 text-center px-8">Masukkan referensi dan judul, AI akan mendesain prosedur otomatis untukmu.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- GLOBAL FLOATING AI ASSISTANT WIDGET --- */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {isChatOpen && (
          <div className="mb-4 w-[340px] sm:w-[400px] h-[450px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-bottom-8 duration-300 origin-bottom-right">
            <div className="bg-[#008080] text-white px-5 py-3 rounded-t-2xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2 font-bold text-sm">
                <MessageSquare size={16} /> Asisten Analisis BAN-PDM
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] bg-green-400 text-[#004d4d] px-2 py-0.5 rounded-full font-black tracking-widest">ONLINE</span>
                <button onClick={() => setIsChatOpen(false)} className="hover:bg-[#006666] p-1 rounded-md transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50" ref={chatContainerRef}>
              {chatHistory.map((chat, idx) => (
                <div key={idx} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-4 py-2.5 rounded-xl text-xs leading-relaxed shadow-sm ${chat.role === 'user' ? 'bg-[#008080] text-white rounded-br-sm' : 'bg-white text-slate-700 rounded-bl-sm border border-slate-200'}`}>
                    {chat.text}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 rounded-bl-sm shadow-sm flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-[#008080]" />
                    <span className="text-xs text-slate-500">Menganalisis...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-white border-t border-slate-100 rounded-b-2xl">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={chatMessage} 
                  onChange={(e) => setChatMessage(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} 
                  placeholder="Tanya soal instrumen atau KBC..." 
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]" 
                  disabled={isChatLoading}
                />
                <button 
                  onClick={handleSendMessage} 
                  disabled={isChatLoading || !chatMessage.trim()}
                  className="bg-[#008080] hover:bg-[#006666] disabled:bg-slate-300 text-white px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center shadow-sm"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`flex items-center justify-center p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${isChatOpen ? 'bg-slate-800 text-white' : 'bg-[#008080] text-white hover:bg-[#006666]'}`}
        >
          {isChatOpen ? <X size={28} /> : <MessageSquare size={28} />}
          {!isChatOpen && (
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
          )}
        </button>
      </div>

    </div>
  );
};

export default App;
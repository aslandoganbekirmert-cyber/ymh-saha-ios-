
import React, { useState, useEffect, useMemo } from 'react';
import './Style.css';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import {
    Home,
    Plus,
    Settings,
    ChevronRight,
    User,
    LogOut,
    Camera as CameraIcon,
    Box,
    Truck,
    ArrowUpRight,
    MapPin,
    Calendar,
    Check,
    Briefcase,
    FileText,
    ArrowLeft,
    X,
    Image as ImageIcon
} from 'lucide-react';

/* --- CONFIG --- */
const API_URL = 'http://localhost:3000'; // Backend URL

/* --- TYPES --- */
interface Project {
    id: string;
    name: string;
    location: string;
    gps_lat?: number;
    gps_lng?: number;
    created_at?: string;
}

interface Transaction {
    id: string;
    project_id: string;
    plate_no: string;
    material: string;
    quantity: number;
    unit: string;
    image_url?: string;
    created_at?: string;
}

/* --- API SERVICE --- */
const api = {
    async getProjects(): Promise<Project[]> {
        try {
            const res = await fetch(`${API_URL}/projects`);
            if (!res.ok) throw new Error('Network error');
            return await res.json();
        } catch (e) {
            console.error('API Error:', e);
            return [];
        }
    },

    async createProject(data: { name: string; location: string }): Promise<Project | null> {
        try {
            const res = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, gps_lat: 0, gps_lng: 0 })
            });
            return await res.json();
        } catch (e) {
            console.error('Create Project Error:', e);
            return null;
        }
    },

    async createTransaction(formData: FormData): Promise<Transaction | null> {
        try {
            const res = await fetch(`${API_URL}/transactions`, {
                method: 'POST',
                body: formData
            });
            return await res.json();
        } catch (e) {
            console.error('Create Transaction Error:', e);
            return null;
        }
    },

    async getTransactions(projectId: string): Promise<Transaction[]> {
        try {
            const res = await fetch(`${API_URL}/transactions?project_id=${projectId}`);
            return await res.json();
        } catch (e) {
            return [];
        }
    }
};

/* --- CONSTANTS --- */
const MATERIALS = ['Hazır Beton C30', 'Demir Ø12', 'İnce Kum', 'Çimento', 'Tuğla', 'Agrega'];
const UNITS = ['Ton', 'm³', 'Adet', 'Sefer'];

export default function App() {
    /* --- STATE --- */
    const [view, setView] = useState<'splash' | 'auth' | 'app'>('splash');
    const [tab, setTab] = useState<'home' | 'settings'>('home');
    const [modal, setModal] = useState<'none' | 'create-project' | 'create-waybill'>('none');

    // Data
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    // Forms
    const [projForm, setProjForm] = useState({ name: '', location: '' });
    const [wbForm, setWbForm] = useState<{
        plateNo: string;
        material: string;
        quantity: string;
        unit: string;
        imageBlob?: Blob;
        imagePreview?: string;
    }>({ plateNo: '', material: '', quantity: '', unit: 'Ton' });

    /* --- INIT --- */
    useEffect(() => {
        const init = async () => {
            // Load Projects from API
            const apiProjects = await api.getProjects();
            setProjects(apiProjects);

            // Check Last Session
            const lastId = localStorage.getItem('last_project_id');
            if (lastId) {
                const found = apiProjects.find(p => p.id === lastId);
                if (found) {
                    selectProject(found);
                    return;
                }
            }

            setTimeout(() => setView('auth'), 2000);
        };
        init();
    }, []);

    /* --- ACTIONS --- */

    // 1. SELECT PROJECT
    const selectProject = async (p: Project) => {
        setActiveProject(p);
        localStorage.setItem('last_project_id', p.id);

        // Load Transactions for Project
        const txs = await api.getTransactions(p.id);
        setTransactions(txs);

        setView('app');
        setTab('home');
    };

    // 2. CREATE PROJECT
    const handleCreateProject = async () => {
        if (!projForm.name) return alert('Lütfen proje adı girin.');

        const newProj = await api.createProject(projForm);
        if (newProj) {
            setProjects([...projects, newProj]);
            setModal('none');
            setProjForm({ name: '', location: '' });
            selectProject(newProj);
        } else {
            alert('Proje oluşturulamadı. Backend bağlantısını kontrol edin.');
        }
    };

    // 3. CREATE TRANSACTION (WAYBILL)
    const handleCreateTransaction = async () => {
        if (!activeProject) return;
        if (!wbForm.imageBlob && (!wbForm.plateNo || !wbForm.material)) {
            return alert('Lütfen fotoğraf çekin veya bilgileri manuel girin.');
        }

        const formData = new FormData();
        formData.append('project_id', activeProject.id);
        formData.append('plate_no', wbForm.plateNo || 'PLAKA OKUNAMADI');
        formData.append('material', wbForm.material || 'BİLİNMİYOR');
        formData.append('quantity', wbForm.quantity || '0');
        formData.append('unit', wbForm.unit);

        if (wbForm.imageBlob) {
            formData.append('file', wbForm.imageBlob, 'photo.jpg');
        }

        const newTx = await api.createTransaction(formData);

        if (newTx) {
            setTransactions([newTx, ...transactions]);
            setModal('none');
            setWbForm({ plateNo: '', material: '', quantity: '', unit: 'Ton' }); // Reset
        } else {
            alert('Kayıt başarısız. Fotoğraf boyutu büyük olabilir veya sunucu hatası.');
        }
    };

    // 4. TAKE PHOTO
    const takePhoto = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 60, // Optimize for upload
                allowEditing: false,
                resultType: CameraResultType.Uri
            });

            // Convert to Blob for Upload
            const response = await fetch(image.webPath!);
            const blob = await response.blob();

            setWbForm(prev => ({
                ...prev,
                imageBlob: blob,
                imagePreview: image.webPath
            }));
        } catch (e) { console.log('Camera cancelled'); }
    };

    /* --- COMPUTED --- */
    const stats = useMemo(() => {
        const totalQty = transactions.reduce((sum, t) => sum + Number(t.quantity), 0);
        return { count: transactions.length, total: totalQty };
    }, [transactions]);


    /* --- VIEWS --- */

    // --> SPLASH SCREEN
    if (view === 'splash') return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
            <img src="/logo.png" style={{ width: 120, height: 'auto', marginBottom: 24 }} alt="YMH Logo" />
            <div style={{ color: '#666', fontSize: 13, letterSpacing: 2 }}>YÜKLENİYOR...</div>
        </div>
    );

    // --> AUTH (PROJECT LIST)
    if (view === 'auth') return (
        <div className="app-shell" style={{ padding: '40px 24px' }}>
            <div style={{ marginBottom: 40, textAlign: 'center' }}>
                <img src="/logo.png" style={{ height: 48, marginBottom: 16 }} alt="YMH Logo" />
                <div style={{ color: '#A1A1AA', fontSize: 14 }}>PROJE YÖNETİM SİSTEMİ</div>
            </div>

            <div style={{ marginBottom: 32 }}>
                <div className="input-label">DEVAM ETMEK İÇİN SEÇİNİZ</div>
                {projects.length === 0 ? (
                    <div style={{ padding: 24, border: '1px dashed #333', borderRadius: 16, color: '#666', textAlign: 'center' }}>
                        Henüz proje yok.
                    </div>
                ) : (
                    projects.map(p => (
                        <div key={p.id} className="premium-card" onClick={() => selectProject(p)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                            <div>
                                <div className="card-title">{p.name}</div>
                                <div className="card-sub">{p.location}</div>
                            </div>
                            <ChevronRight color="#666" />
                        </div>
                    ))
                )}
            </div>

            <button className="btn-gold" onClick={() => setModal('create-project')}>
                <Plus size={20} /> YENİ PROJE BAŞLAT
            </button>

            {/* MODAL: CREATE PROJECT */}
            {modal === 'create-project' && (
                <div className="sheet-backdrop">
                    <div style={{ flex: 1 }} onClick={() => setModal('none')}></div>
                    <div className="sheet-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                            <div className="card-title" style={{ fontSize: 20 }}>Yeni Proje</div>
                            <div onClick={() => setModal('none')}><X color="#666" /></div>
                        </div>

                        <div className="input-group">
                            <label className="input-label">PROJE ADI</label>
                            <input className="premium-input" placeholder="Örn: Merkez Depo İnşaatı"
                                value={projForm.name} onChange={e => setProjForm({ ...projForm, name: e.target.value })} autoFocus />
                        </div>
                        <div className="input-group">
                            <label className="input-label">LOKASYON</label>
                            <input className="premium-input" placeholder="İlçe, İl"
                                value={projForm.location} onChange={e => setProjForm({ ...projForm, location: e.target.value })} />
                        </div>

                        <button className="btn-gold" onClick={handleCreateProject}>OLUŞTUR</button>
                    </div>
                </div>
            )}
        </div>
    );

    // --> MAIN APP
    return (
        <div className="app-shell" style={{ paddingBottom: 100 }}>
            {/* Header */}
            <div className="brand-header">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <img src="/logo.png" className="brand-logo-img" alt="YMH" />
                    <div className="brand-title">{activeProject?.name}</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: '#18181B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={18} color="#fff" />
                </div>
            </div>

            {/* Dashboard Content */}
            <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                {tab === 'home' && (
                    <>
                        <div className="stat-grid">
                            <div className="stat-box">
                                <Truck size={24} color="#FFD700" />
                                <div className="stat-val">{stats.count}</div>
                                <div className="stat-lbl">ARAÇ SAYISI</div>
                            </div>
                            <div className="stat-box">
                                <Box size={24} color="#fff" />
                                <div className="stat-val">{stats.total.toLocaleString()}</div>
                                <div className="stat-lbl">TOPLAM TONAJ</div>
                            </div>
                        </div>

                        <div className="input-label" style={{ marginBottom: 12 }}>SON İŞLEMLER</div>
                        {transactions.length === 0 ? (
                            <div style={{ padding: 40, textAlign: 'center', color: '#666', border: '1px dashed #333', borderRadius: 16 }}>
                                <FileText size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                                <div>Henüz kayıt yok.</div>
                            </div>
                        ) : (
                            transactions.map(t => (
                                <div key={t.id} className="premium-card" style={{ marginBottom: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 12, background: '#27272A', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {t.image_url ? (
                                            <img src={`${API_URL}${t.image_url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <Truck size={20} color="#666" />
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: '#fff', fontWeight: 700 }}>{t.plate_no}</div>
                                        <div style={{ color: '#A1A1AA', fontSize: 13 }}>{t.material}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ color: '#FFD700', fontWeight: 700, fontSize: 16 }}>{t.quantity} <span style={{ fontSize: 12 }}>{t.unit}</span></div>
                                    </div>
                                </div>
                            ))
                        )}
                    </>
                )}

                {tab === 'settings' && (
                    <div style={{ paddingTop: 20 }}>
                        <div className="premium-card" onClick={() => {
                            localStorage.removeItem('last_project_id');
                            setActiveProject(null);
                            setView('auth');
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <LogOut color="#EF4444" size={20} />
                                <div style={{ color: '#EF4444', fontWeight: 700 }}>Çıkış Yap</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Nav */}
            <div className="nav-bar">
                <div className={`nav-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
                    <Home size={24} />
                    <span>Ana Sayfa</span>
                </div>

                <div className="nav-fab" onClick={() => setModal('create-waybill')}>
                    <Plus size={32} color="#000" />
                </div>

                <div className={`nav-item ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
                    <Settings size={24} />
                    <span>Ayarlar</span>
                </div>
            </div>

            {/* MODAL: CREATE WAYBILL */}
            {modal === 'create-waybill' && (
                <div className="sheet-backdrop">
                    <div style={{ flex: 1 }} onClick={() => setModal('none')}></div>
                    <div className="sheet-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                            <div className="card-title" style={{ fontSize: 20 }}>Yeni Kayıt</div>
                            <div onClick={() => setModal('none')}><X color="#666" /></div>
                        </div>

                        {/* FOTOĞRAF */}
                        <div className={`ph-img ${wbForm.imagePreview ? 'has-img' : ''}`} onClick={takePhoto}>
                            {wbForm.imagePreview ? (
                                <>
                                    <Check size={24} style={{ marginBottom: 8 }} />
                                    <span>FOTOĞRAF EKLENDİ (DEĞİŞTİR)</span>
                                </>
                            ) : (
                                <>
                                    <CameraIcon size={32} style={{ marginBottom: 8 }} />
                                    <span>FİŞ FOTOĞRAFI EKLE (OCR)</span>
                                </>
                            )}
                        </div>

                        {/* MANUEL GİRİŞ */}
                        <div className="input-group">
                            <label className="input-label">ARAÇ PLAKASI</label>
                            <input className="premium-input" placeholder="35 ABC 123"
                                value={wbForm.plateNo} onChange={e => setWbForm({ ...wbForm, plateNo: e.target.value.toUpperCase() })} />
                        </div>

                        <div className="input-group">
                            <label className="input-label">MALZEME</label>
                            <select className="premium-input" value={wbForm.material} onChange={e => setWbForm({ ...wbForm, material: e.target.value })}>
                                <option value="">Seçiniz...</option>
                                {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: 16 }}>
                            <div className="input-group" style={{ flex: 1 }}>
                                <label className="input-label">MİKTAR</label>
                                <input type="number" className="premium-input" placeholder="0"
                                    value={wbForm.quantity} onChange={e => setWbForm({ ...wbForm, quantity: e.target.value })} />
                            </div>
                            <div className="input-group" style={{ width: 100 }}>
                                <label className="input-label">BİRİM</label>
                                <select className="premium-input" value={wbForm.unit} onChange={e => setWbForm({ ...wbForm, unit: e.target.value })}>
                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>

                        <button className="btn-gold" onClick={handleCreateTransaction}>KAYDET</button>
                    </div>
                </div>
            )}
        </div>
    );
}

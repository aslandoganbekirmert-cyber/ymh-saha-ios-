
import React, { useState, useEffect, useMemo } from 'react';
import './Style.css';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Geolocation } from '@capacitor/geolocation';
import {
    Home,
    Plus,
    User,
    LogOut,
    Camera as CameraIcon,
    Truck,
    MapPin,
    ArrowLeft,
    CheckCircle,
    AlertTriangle,
    RefreshCw
} from 'lucide-react';

/* --- CONFIGURATION --- */
const API_BASE = 'http://34.76.183.133:3000'; // Production Server

/* --- TYPES --- */
interface Project {
    id: string;
    name: string;
    location: string;
}

interface Transaction {
    id: string;
    project_id: string;
    plate_no: string;
    material: string;
    quantity: number;
    unit: string;
    created_at?: string;
    gps_lat?: number;
    gps_lng?: number;
    image_url?: string;
}

/* --- FIELD API SERVICE --- */
const FieldApi = {
    async fetchProjects() {
        try {
            const res = await fetch(`${API_BASE}/projects`);
            return res.ok ? await res.json() : [];
        } catch (e) {
            console.error('Network Error:', e);
            return []; // Offline handling could be added here
        }
    },

    async createProject(name: string, location: string) {
        try {
            // Get GPS for Project Location
            const pos = await Geolocation.getCurrentPosition();

            const res = await fetch(`${API_BASE}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    location,
                    gps_lat: pos.coords.latitude,
                    gps_lng: pos.coords.longitude
                })
            });
            return await res.json();
        } catch (e) {
            alert('Konum alınamadı veya sunucu hatası.');
            return null;
        }
    },

    async uploadTransaction(activeProject: Project, form: any, imageBlob?: Blob) {
        try {
            const formData = new FormData();
            formData.append('project_id', activeProject.id);
            formData.append('plate_no', form.plateNo || 'PLAKA_OCR_BEKLENIYOR');
            formData.append('material', form.material);
            formData.append('quantity', form.quantity);
            formData.append('unit', form.unit);

            // Add GPS Verification
            const pos = await Geolocation.getCurrentPosition();
            formData.append('gps_lat', String(pos.coords.latitude));
            formData.append('gps_lng', String(pos.coords.longitude));

            if (imageBlob) {
                formData.append('file', imageBlob, 'site_photo.jpg');
            }

            const res = await fetch(`${API_BASE}/transactions`, {
                method: 'POST',
                body: formData
            });

            return await res.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    async getProjectTransactions(projectId: string) {
        try {
            const res = await fetch(`${API_BASE}/transactions?project_id=${projectId}`);
            return res.ok ? await res.json() : [];
        } catch (e) { return []; }
    }
};

/* --- CONSTANTS --- */
const MATERIALS = ['Hazır Beton C30', 'Demir Ø12', 'İnce Kum', 'Çimento', 'Tuğla', 'Dolgu Toprak'];
const UNITS = ['Ton', 'm³', 'Adet', 'Sefer'];

export default function App() {
    /* --- STATE --- */
    const [view, setView] = useState<'loading' | 'auth' | 'dashboard' | 'camera'>('loading');
    const [modal, setModal] = useState<'none' | 'new-project'>('none');

    // Data
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    // Forms
    const [newProjName, setNewProjName] = useState('');
    const [wbForm, setWbForm] = useState({
        plateNo: '', material: 'Hazır Beton C30', quantity: '', unit: 'Ton',
        imageBlob: null as Blob | null, imagePreview: ''
    });

    /* --- INITIALIZATION --- */
    useEffect(() => {
        loadApp();
    }, []);

    const loadApp = async () => {
        setView('loading');
        const list = await FieldApi.fetchProjects();
        setProjects(list);

        const lastId = localStorage.getItem('active_site_id');
        if (lastId) {
            const found = list.find((p: Project) => p.id === lastId);
            if (found) {
                enterSite(found);
                return;
            }
        }
        setView('auth');
    };

    const enterSite = async (p: Project) => {
        setActiveProject(p);
        localStorage.setItem('active_site_id', p.id);

        // Load Data
        const txs = await FieldApi.getProjectTransactions(p.id);
        setTransactions(txs);

        setView('dashboard');
    };

    /* --- ACTIONS --- */
    const handleNewProject = async () => {
        if (!newProjName) return alert('Şantiye Adı Giriniz');
        const p = await FieldApi.createProject(newProjName, 'Saha Konumu');
        if (p) {
            setProjects([...projects, p]);
            setModal('none');
            enterSite(p);
        }
    };

    const handleTakePhoto = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 60,
                allowEditing: false,
                resultType: CameraResultType.Uri
            });

            const response = await fetch(image.webPath!);
            const blob = await response.blob();

            setWbForm(prev => ({ ...prev, imageBlob: blob, imagePreview: image.webPath! }));
        } catch (e) { console.log('Camera cancelled'); }
    };

    const handleSubmitWaybill = async () => {
        if (!activeProject) return;
        if (!wbForm.imageBlob && !wbForm.quantity) return alert('Fotoğraf veya Miktar gerekli.');

        setView('loading'); // Show submitting state
        const res = await FieldApi.uploadTransaction(activeProject, wbForm, wbForm.imageBlob || undefined);

        if (res) {
            setTransactions([res, ...transactions]);
            setWbForm({ plateNo: '', material: 'Hazır Beton C30', quantity: '', unit: 'Ton', imageBlob: null, imagePreview: '' });
            setView('dashboard');
        } else {
            alert('Gönderim Başarısız. İnternet bağlantınızı kontrol edin.');
            setView('dashboard');
        }
    };

    /* --- VIEWS --- */

    // 1. LOADING / SPLASH
    if (view === 'loading') return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <img src="/logo.png" style={{ width: 140, marginBottom: 20 }} />
            <div style={{ fontFamily: 'Chakra Petch', fontWeight: 700, fontSize: 14 }}>SAHA YÜKLENİYOR...</div>
        </div>
    );

    // 2. AUTH (PROJECT SELECT)
    if (view === 'auth') return (
        <div id="root">
            <div style={{ padding: 20, textAlign: 'center' }}>
                <img src="/logo.png" style={{ height: 40, marginBottom: 12 }} />
                <div style={{ fontSize: 18, fontWeight: 700 }}>ŞANTİYE SEÇİMİ</div>
            </div>

            <div className="tx-list" style={{ background: '#F4F4F5' }}>
                {projects.map(p => (
                    <div key={p.id} className="field-card active" onClick={() => enterSite(p)} style={{ cursor: 'pointer' }}>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 18 }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: '#666' }}>{p.location}</div>
                        </div>
                        <Truck size={20} />
                    </div>
                ))}
            </div>

            <div style={{ padding: 20 }}>
                <button className="btn-field btn-secondary" onClick={() => setModal('new-project')}>
                    <Plus /> YENİ ŞANTİYE
                </button>
            </div>

            {/* NEW PROJECT MODAL */}
            {modal === 'new-project' && (
                <div className="full-overlay">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>YENİ ŞANTİYE</div>
                        <div onClick={() => setModal('none')}><div style={{ padding: 10 }}>İPTAL</div></div>
                    </div>

                    <div className="input-label">PROJE ADI</div>
                    <input className="field-input" placeholder="ÖRNEK: MERKEZ DEPO"
                        value={newProjName} onChange={e => setNewProjName(e.target.value)} autoFocus />

                    <div style={{ marginTop: 20, fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MapPin size={14} /> GPS Konumu Otomatik Alınacak
                    </div>

                    <button className="btn-field btn-primary" style={{ marginTop: 'auto' }} onClick={handleNewProject}>
                        BAŞLAT
                    </button>
                </div>
            )}
        </div>
    );

    // 3. CREATE WAYBILL (CAMERA VIEW)
    if (view === 'camera') return (
        <div className="full-overlay">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
                <div onClick={() => setView('dashboard')} style={{ paddingRight: 20 }}><ArrowLeft /></div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>YENİ İRSALİYE</div>
            </div>

            <div className={`camera-box ${wbForm.imagePreview ? 'has-img' : ''}`} onClick={handleTakePhoto}>
                {wbForm.imagePreview ? (
                    <>
                        <CheckCircle size={40} color="#000" style={{ marginBottom: 10 }} />
                        <div style={{ fontWeight: 700 }}>FOTOĞRAF HAZIR</div>
                        <div style={{ fontSize: 12 }}>Değiştirmek için dokun</div>
                    </>
                ) : (
                    <>
                        <CameraIcon size={40} style={{ marginBottom: 10 }} />
                        <div style={{ fontWeight: 700 }}>FİŞ FOTOĞRAFI ÇEK</div>
                        <div style={{ fontSize: 12 }}>OCR İLE OTOMATİK OKUNUR</div>
                    </>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                    <div className="input-label">PLAKA (OPSİYONEL)</div>
                    <input className="field-input" placeholder="35.." value={wbForm.plateNo}
                        onChange={e => setWbForm({ ...wbForm, plateNo: e.target.value.toUpperCase() })} />
                </div>
                <div>
                    <div className="input-label">MİKTAR</div>
                    <input type="number" className="field-input" placeholder="0" value={wbForm.quantity}
                        onChange={e => setWbForm({ ...wbForm, quantity: e.target.value })} />
                </div>
            </div>

            <div style={{ marginTop: 12 }}>
                <div className="input-label">MALZEME</div>
                <select className="field-input" value={wbForm.material} onChange={e => setWbForm({ ...wbForm, material: e.target.value })}>
                    {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>

            <button className="btn-field btn-primary" style={{ marginTop: 'auto' }} onClick={handleSubmitWaybill}>
                KAYDET VE GÖNDER
            </button>
        </div>
    );

    // 4. DASHBOARD (MAIN)
    const stats = transactions.reduce((acc, t) => ({ count: acc.count + 1, total: acc.total + Number(t.quantity || 0) }), { count: 0, total: 0 });

    return (
        <div id="root">
            <div className="field-header">
                <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#999' }}>AKTİF ŞANTİYE</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{activeProject?.name}</div>
                </div>
                <div onClick={() => { localStorage.removeItem('active_site_id'); setView('auth'); }}>
                    <LogOut size={24} color="#000" />
                </div>
            </div>

            <div className="tx-list">
                <div className="stat-layout">
                    <div className="stat-box">
                        <div className="stat-num">{stats.count}</div>
                        <div className="stat-lbl">GELEN ARAÇ</div>
                    </div>
                    <div className="stat-box" style={{ background: '#FFD600', borderColor: '#000' }}>
                        <div className="stat-num">{stats.total}</div>
                        <div className="stat-lbl" style={{ color: '#000' }}>TOPLAM TONAJ</div>
                    </div>
                </div>

                <button className="btn-field btn-primary" style={{ marginBottom: 24 }} onClick={() => setView('camera')}>
                    <CameraIcon style={{ marginRight: 8 }} /> YENİ GİRİŞ YAP
                </button>

                <div className="input-label">SON HAREKETLER</div>
                {transactions.map(t => (
                    <div key={t.id} className="tx-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {t.image_url ? <CheckCircle size={16} color="green" /> : <AlertTriangle size={16} color="orange" />}
                            <div>
                                <div className="tx-plate">{t.plate_no || 'PLAKA YOK'}</div>
                                <div className="tx-detail">{t.material}</div>
                            </div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 18 }}>{t.quantity} <span style={{ fontSize: 12 }}>{t.unit}</span></div>
                    </div>
                ))}
            </div>
        </div>
    );
}

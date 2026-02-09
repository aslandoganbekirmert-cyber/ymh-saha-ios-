
import React, { useState, useEffect } from 'react';
import './Style.css';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation'; // Konum için
import {
    Users,
    Plus,
    Camera as CameraIcon,
    ArrowLeft,
    MapPin,
    Truck,
    LogOut,
    CheckCircle,
    AlertTriangle,
    RefreshCw
} from 'lucide-react';

/* --- AYARLAR --- */
const API_URL = 'http://34.76.183.133:3000'; // Canlı Sunucu

/* --- TİPLER --- */
interface Project {
    id: string;
    name: string;
    location: string;
}

interface Transaction {
    id: string;
    plate_no: string;
    material: string;
    quantity: number;
    unit: string;
    image_url?: string;
    created_at?: string;
}

export default function App() {
    /* --- STATE --- */
    const [view, setView] = useState<'auth' | 'dashboard' | 'camera' | 'new-site'>('auth');
    const [loading, setLoading] = useState(false);

    // Veriler
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    // Formlar
    const [newSiteName, setNewSiteName] = useState('');
    const [wbForm, setWbForm] = useState({
        plate: '',
        material: 'Hazır Beton',
        qty: '',
        unit: 'Ton',
        imgBlob: null as Blob | null,
        imgPreview: ''
    });

    /* --- BAŞLANGIÇ --- */
    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/projects`);
            if (res.ok) {
                const data = await res.json();
                setProjects(data);

                // Son oturumu kontrol et
                const lastId = localStorage.getItem('last_site_id');
                if (lastId) {
                    const saved = data.find((p: Project) => p.id === lastId);
                    if (saved) openDashboard(saved);
                }
            } else {
                alert('Sunucuya erişilemedi. İnternet bağlantınızı kontrol edin.');
            }
        } catch (e) {
            console.error(e);
            alert('Bağlantı Hatası!');
        } finally {
            setLoading(false);
        }
    };

    /* --- İŞLEMLER --- */
    const openDashboard = async (p: Project) => {
        setActiveProject(p);
        localStorage.setItem('last_site_id', p.id);
        setView('dashboard');

        // Verileri Yükle
        try {
            const res = await fetch(`${API_URL}/transactions?project_id=${p.id}`);
            if (res.ok) setTransactions(await res.json());
        } catch (e) { console.error(e); }
    };

    const createSite = async () => {
        if (!newSiteName) return alert('Şantiye adı boş olamaz!');
        setLoading(true);

        try {
            // Konum almayı dene (Opsiyonel)
            let lat = 0, lng = 0;
            try {
                const pos = await Geolocation.getCurrentPosition();
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
            } catch (e) { console.log('GPS alınamadı, devam ediliyor.'); }

            const res = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newSiteName, location: 'Saha Konumu', gps_lat: lat, gps_lng: lng })
            });

            if (res.ok) {
                const newP = await res.json();
                setProjects([...projects, newP]);
                setView('auth');
                setNewSiteName('');
                openDashboard(newP); // Direkt gir
            } else {
                alert('Oluşturma başarısız.');
            }
        } catch (e) {
            alert('Hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const takePhoto = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 60,
                allowEditing: false,
                resultType: CameraResultType.Uri
            });

            // Blob'a çevir
            const response = await fetch(image.webPath!);
            const blob = await response.blob();

            setWbForm(prev => ({ ...prev, imgBlob: blob, imgPreview: image.webPath! }));
        } catch (e) { console.log('Kamera iptal'); }
    };

    const saveWaybill = async () => {
        if (!activeProject) return;
        if (!wbForm.qty && !wbForm.imgBlob) return alert('Miktar girin veya fotoğraf çekin.');

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('project_id', activeProject.id);
            formData.append('plate_no', wbForm.plate || 'PLAKA YOK');
            formData.append('material', wbForm.material);
            formData.append('quantity', wbForm.qty || '0');
            formData.append('unit', wbForm.unit);

            if (wbForm.imgBlob) {
                formData.append('file', wbForm.imgBlob, 'photo.jpg');
            }

            // Konum Ekle
            try {
                const pos = await Geolocation.getCurrentPosition();
                formData.append('gps_lat', String(pos.coords.latitude));
                formData.append('gps_lng', String(pos.coords.longitude));
            } catch (e) { }

            const res = await fetch(`${API_URL}/transactions`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const newTx = await res.json();
                setTransactions([newTx, ...transactions]);
                setView('dashboard');
                setWbForm({ plate: '', material: 'Hazır Beton', qty: '', unit: 'Ton', imgBlob: null, imgPreview: '' });
            } else {
                alert('Kayıt başarısız oldu.');
            }

        } catch (e) {
            alert('Gönderim hatası!');
        } finally {
            setLoading(false);
        }
    };

    /* --- EKRANLAR --- */

    // 1. ŞANTİYE SEÇİMİ (AUTH)
    if (view === 'auth') return (
        <div id="root">
            <div className="header-bar" style={{ justifyContent: 'center' }}>
                <img src="/logo.png" className="brand-logo" alt="YMH" />
            </div>

            <div className="content-scroll">
                <div className="form-label">ŞANTİYE SEÇİMİ</div>
                {projects.length === 0 && !loading && <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>Kayıtlı şantiye yok.</div>}

                {projects.map(p => (
                    <button key={p.id} className="btn-action btn-secondary" style={{ marginBottom: 12, justifyContent: 'space-between', padding: '0 20px', textTransform: 'none' }} onClick={() => openDashboard(p)}>
                        <span style={{ fontWeight: 700 }}>{p.name}</span>
                        <Truck size={20} color="#000" />
                    </button>
                ))}

                <div style={{ padding: 20 }}></div>
                <button className="btn-action" onClick={() => setView('new-site')}>
                    <Plus size={24} /> YENİ ŞANTİYE
                </button>
            </div>

            {loading && <div className="modal-layer" style={{ background: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' }}>
                <div>YÜKLENİYOR...</div>
            </div>}
        </div>
    );

    // 2. YENİ ŞANTİYE
    if (view === 'new-site') return (
        <div className="modal-layer">
            <div className="modal-header">
                <h3>YENİ ŞANTİYE</h3>
                <div onClick={() => setView('auth')} style={{ padding: 10 }}>İPTAL</div>
            </div>
            <div style={{ padding: 20 }}>
                <div className="form-group">
                    <label className="form-label">PROJE / ŞANTİYE ADI</label>
                    <input className="form-input" placeholder="ÖRN: MERKEZ DEPO" value={newSiteName} onChange={e => setNewSiteName(e.target.value)} autoFocus />
                </div>
                <button className="btn-action" onClick={createSite} disabled={loading}>
                    {loading ? 'KAYDEDİLİYOR...' : 'OLUŞTUR VE GİR'}
                </button>
            </div>
        </div>
    );

    // 3. DASHBOARD (ANA EKRAN)
    if (view === 'dashboard') {
        // İstatistik
        const totalTon = transactions.reduce((acc, t) => acc + Number(t.quantity || 0), 0);

        return (
            <div id="root">
                <div className="header-bar">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <img src="/logo.png" className="brand-logo" alt="YMH" style={{ height: 32, marginRight: 12 }} />
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{activeProject?.name}</div>
                    </div>
                    <div onClick={() => { localStorage.removeItem('last_site_id'); setView('auth'); }}>
                        <LogOut size={24} color="#000" />
                    </div>
                </div>

                <div className="content-scroll">
                    <div className="stat-row">
                        <div className="stat-item">
                            <div className="stat-val">{transactions.length}</div>
                            <div className="stat-tag">SEFER</div>
                        </div>
                        <div className="stat-item" style={{ background: '#FFD600', borderColor: '#E5C300' }}>
                            <div className="stat-val">{totalTon}</div>
                            <div className="stat-tag" style={{ color: '#000' }}>TOPLAM TONAJ</div>
                        </div>
                    </div>

                    <button className="btn-action" style={{ marginBottom: 24 }} onClick={() => setView('camera')}>
                        <CameraIcon /> YENİ GİRİŞ YAP
                    </button>

                    <div className="form-label">SON HAREKETLER</div>
                    {transactions.map(t => (
                        <div key={t.id} className="info-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {t.image_url ? <CheckCircle size={20} color="#10b981" /> : <AlertTriangle size={20} color="#f59e0b" />}
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 16 }}>{t.plate_no || 'PLAKA YOK'}</div>
                                    <div style={{ fontSize: 12, color: '#666' }}>{t.material}</div>
                                </div>
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 18 }}>
                                {t.quantity} <span style={{ fontSize: 12 }}>{t.unit}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // 4. KAMERA / GİRİŞ EKRANI
    if (view === 'camera') return (
        <div className="modal-layer">
            <div className="modal-header">
                <div style={{ fontWeight: 800 }}>YENİ İRSALİYE</div>
                <div onClick={() => setView('dashboard')} style={{ padding: 10 }}><ArrowLeft /></div>
            </div>

            <div className="content-scroll">
                <div className={`camera-trigger ${wbForm.imgPreview ? 'filled' : ''}`} onClick={takePhoto}>
                    {wbForm.imgPreview ? (
                        <>
                            <CheckCircle size={48} style={{ marginBottom: 8 }} />
                            <div style={{ fontWeight: 700 }}>FOTOĞRAF ALINDI</div>
                        </>
                    ) : (
                        <>
                            <CameraIcon size={48} style={{ marginBottom: 8 }} />
                            <div style={{ fontWeight: 700 }}>FOTOĞRAF ÇEK</div>
                            <div style={{ fontSize: 12 }}>OCR İLE OKUNACAK</div>
                        </>
                    )}
                </div>

                <div className="stat-row">
                    <div className="form-group">
                        <label className="form-label">PLAKA (OPSİYONEL)</label>
                        <input className="form-input" placeholder="35.." value={wbForm.plate} onChange={e => setWbForm({ ...wbForm, plate: e.target.value.toUpperCase() })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">MİKTAR</label>
                        <input type="number" className="form-input" placeholder="0" value={wbForm.qty} onChange={e => setWbForm({ ...wbForm, qty: e.target.value })} />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">MALZEME</label>
                    <select className="form-input" value={wbForm.material} onChange={e => setWbForm({ ...wbForm, material: e.target.value })}>
                        {['Hazır Beton C30', 'Demir Ø12', 'İnce Kum', 'Çimento', 'Tuğla', 'Diğer'].map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                <button className="btn-action" onClick={saveWaybill} disabled={loading}>
                    {loading ? 'GÖNDERİLİYOR...' : 'KAYDET VE GÖNDER'}
                </button>
            </div>
        </div>
    );
}
